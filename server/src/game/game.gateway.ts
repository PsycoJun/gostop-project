import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { GameService } from "./game.service";
import { v4 as uuidv4 } from "uuid";
import pkg from "jsonwebtoken";
const { verify } = pkg;

interface JwtPayload {
  userId: string;
  username: string;
  iat: number;
  exp: number;
}

function isError(error: unknown): error is Error {
  return typeof error === "object" && error !== null && "message" in error;
}

interface StartGameResult {
  nextPlayerId: string | null;
}

// 소켓 객체에 userId와 username을 추가하기 위한 인터페이스 확장
interface AuthenticatedSocket extends Socket {
  userId: string;
  username: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL || ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  path: '/socket.io/',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // 플레이어와 방 정보를 관리하기 위한 맵
  private connectedPlayers = new Map<
    string,
    { username: string; socketId: string; roomId?: string }
  >();
  private roomsMetadata = new Map<
    string,
    { hostId: string; playerIds: Set<string>; gameStarted: boolean; readyPlayers: Set<string> }
  >();

  // NestJS의 의존성 주입(DI) 시스템을 통해 GameService 인스턴스를 주입받음
  constructor(private readonly gameService: GameService) {}

  /**
   * 클라이언트가 연결을 시도할 때마다 실행되는 인증 로직
   */
  handleConnection(socket: Socket) {
    console.log(`🔗 연결 시도: ${socket.id}`);
    
    try {
      // 토큰 추출 (여러 방법으로 시도)
      const token = 
        socket.handshake.auth?.token || 
        socket.handshake.query?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        console.log('❌ 토큰 없음');
        socket.emit('auth_error', '인증 토큰이 필요합니다.');
        socket.disconnect(true);
        return;
      }

      console.log('🔐 토큰 검증 중...');
      const decoded = verify(
        token,
        process.env.JWT_SECRET || 'your_jwt_secret',
      ) as JwtPayload;

      // 검증 성공
      const authSocket = socket as AuthenticatedSocket;
      authSocket.userId = decoded.userId;
      authSocket.username = decoded.username;
      
      this.connectedPlayers.set(authSocket.userId, {
        username: authSocket.username,
        socketId: authSocket.id,
      });

      console.log(`✅ [인증 성공] ${authSocket.username} (${authSocket.userId})`);
      
      // 연결 성공 이벤트 명시적으로 전송
      socket.emit('authenticated', { 
        userId: authSocket.userId, 
        username: authSocket.username 
      });
      
      this.broadcastLobbyInfo();

    } catch (error) {
      console.error('❌ [인증 실패]', error);
      socket.emit('auth_error', '유효하지 않은 토큰입니다.');
      socket.disconnect(true);
    }
  }

  /**
   * 클라이언트 연결이 끊어졌을 때 실행되는 NestJS 생명주기 메서드
   * @param socket 연결이 끊어진 클라이언트의 소켓 객체
   */
  public handleDisconnect(socket: AuthenticatedSocket) {
    if (!socket.userId) return;

    const playerInfo = this.connectedPlayers.get(socket.userId);
    if (playerInfo?.roomId) {
      // TODO: 게임 중에 나갔을 때의 처리 로직 (예: 게임 중단, 재접속 대기)
      this.handleLeaveRoom(socket);
    }

    this.connectedPlayers.delete(socket.userId);
    console.log(`❌ [연결 해제] ${socket.username}`);
    this.broadcastLobbyInfo();
  }

  // --- 로비 관련 이벤트 핸들러 ---

  @SubscribeMessage("createRoom")
  handleCreateRoom(@ConnectedSocket() socket: AuthenticatedSocket) {
    const roomId = uuidv4().slice(0, 8); // 짧은 방 ID 생성
    const { userId } = socket;

    this.roomsMetadata.set(roomId, {
      hostId: userId,
      playerIds: new Set([userId]),
      gameStarted: false,
      readyPlayers: new Set(),
    });
    const player = this.connectedPlayers.get(userId);
    if (player) {
      player.roomId = roomId;
    }

    socket.join(roomId);
    socket.emit("roomCreated", { roomId, hostId: userId });

    console.log(
      `🚪 [방 생성] ${socket.username}님이 ${roomId} 방을 생성했습니다.`,
    );
    this.broadcastLobbyInfo();
    this.broadcastRoomInfo(roomId);
  }

  @SubscribeMessage("joinRoom")
  handleJoinRoom(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() roomId: string,
  ) {
    const room = this.roomsMetadata.get(roomId);
    const { userId } = socket;

    if (!room || room.playerIds.size >= 4) {
      return socket.emit("gameError", "방이 가득 찼거나 존재하지 않습니다.");
    }

    room.playerIds.add(userId);
    const player = this.connectedPlayers.get(userId);
    if (player) {
      player.roomId = roomId;
    }

    socket.join(roomId);
    socket.emit("roomJoined", { roomId, hostId: room.hostId });

    console.log(
      `📥 [방 참가] ${socket.username}님이 ${roomId} 방에 참가했습니다.`,
    );
    this.broadcastLobbyInfo();
    this.broadcastRoomInfo(roomId);
  }

  @SubscribeMessage("readyGame")
  handleReadyGame(@ConnectedSocket() socket: AuthenticatedSocket) {
    const { userId } = socket;
    const playerInfo = this.connectedPlayers.get(userId);
    if (!playerInfo?.roomId) return;

    const { roomId } = playerInfo;
    const room = this.roomsMetadata.get(roomId);
    if (!room) return;

    // Add player to readyPlayers set
    room.readyPlayers.add(userId);
    console.log(`[Gateway] Player ${socket.username} is ready in room ${roomId}. Ready players: ${Array.from(room.readyPlayers).join(', ')}`);

    // Broadcast updated room info to reflect ready status
    this.broadcastRoomInfo(roomId);
  }

  @SubscribeMessage("leaveRoom")
  handleLeaveRoom(@ConnectedSocket() socket: AuthenticatedSocket) {
    const { userId } = socket;
    const playerInfo = this.connectedPlayers.get(userId);
    if (!playerInfo?.roomId) return;

    const { roomId } = playerInfo;
    const room = this.roomsMetadata.get(roomId);
    if (!room) return;

    socket.leave(roomId);
    room.playerIds.delete(userId);
    playerInfo.roomId = undefined;

    // 방이 비었으면 5초 후 삭제되도록 유예 시간을 둠
    if (room.playerIds.size === 0) {
      console.log(`[방 비어있음] ${roomId} 방이 비어있습니다. 5초 후 삭제됩니다.`);
      setTimeout(() => {
        const currentRoom = this.roomsMetadata.get(roomId);
        if (currentRoom && currentRoom.playerIds.size === 0) {
          this.roomsMetadata.delete(roomId);
          this.gameService.deleteRoom(roomId);
          console.log(`🗑️ [방 삭제] ${roomId} 방이 비어서 삭제되었습니다.`);
          this.broadcastLobbyInfo(); // 방 삭제 후 로비 정보 갱신
        }
      }, 5000); // 5초 유예
    } else {
      // 호스트가 나갔으면 새로운 호스트 지정
      if (room.hostId === userId) {
        room.hostId = Array.from(room.playerIds)[0];
        console.log(
          `👑 [호스트 변경] ${roomId} 방의 새 호스트: ${room.hostId}`,
        );
      }
      this.broadcastRoomInfo(roomId);
    }

    console.log(
      `📤 [방 퇴장] ${socket.username}님이 ${roomId} 방에서 나갔습니다.`,
    );
    this.broadcastLobbyInfo();
  }

  // --- 게임 진행 관련 이벤트 핸들러 ---

  @SubscribeMessage("startGame")
  async handleStartGame(@ConnectedSocket() socket: AuthenticatedSocket) {
    console.log(`[Gateway] Received startGame event from ${socket.username} for room ${this.connectedPlayers.get(socket.userId)?.roomId}`);
    const { userId } = socket;
    const roomId = this.connectedPlayers.get(userId)?.roomId;
    const room = this.roomsMetadata.get(roomId!);

    if (!roomId || !room || room.hostId !== userId) {
      console.log(`[Gateway] startGame error: Invalid room or not host. RoomId: ${roomId}, Host: ${room?.hostId}, User: ${userId}`);
      return socket.emit("gameError", "호스트만 게임을 시작할 수 있습니다.");
    }
    if (room.playerIds.size < 2) {
      console.log(`[Gateway] startGame error: Not enough players. RoomId: ${roomId}, Players: ${room.playerIds.size}`);
      return socket.emit(
        "gameError",
        "최소 2명 이상이어야 시작할 수 있습니다.",
      );
    }

    try {
      console.log(`[Gateway] Calling gameService.createRoom for roomId: ${roomId}`);
      const playerIds = Array.from(room.playerIds);
      await this.gameService.createRoom(roomId, playerIds);

      console.log(`[Gateway] Calling gameService.startGame for roomId: ${roomId}`);
      const result: StartGameResult = this.gameService.startGame(roomId);

      // Update room metadata to reflect game started
      const currentRoom = this.roomsMetadata.get(roomId);
      if (currentRoom) {
        currentRoom.gameStarted = true;
        this.roomsMetadata.set(roomId, currentRoom);
      }

      console.log(`🚀 [게임 시작] ${roomId} 방에서 게임을 시작합니다. Emitting gameStarted.`);
      this.server.to(roomId).emit("gameStarted");
      this.broadcastGameState(roomId);

      if (result.nextPlayerId) {
        this.promptPlayer(result.nextPlayerId, "promptParticipation");
      }
    } catch (error: unknown) {
      console.error(`[Gateway] Error during startGame for roomId ${roomId}:`, error);
      if (isError(error)) {
        socket.emit("gameError", error.message);
      } else {
        socket.emit("gameError", "알 수 없는 게임 시작 오류가 발생했습니다.");
      }
    }
  }

  // ... (playCard, goStopDecision 등 다른 게임 액션 핸들러들 추가) ...

  // --- 정보 전파용 헬퍼 메서드 ---

  /** 로비에 있는 모든 유저에게 방 목록과 접속자 목록을 브로드캐스트합니다. */
  private broadcastLobbyInfo() {
    const roomList = Array.from(this.roomsMetadata.entries()).map(
      ([roomId, data]) => ({
        id: roomId,
        playerCount: data.playerIds.size,
        playerNames: Array.from(data.playerIds).map(
          (id) => this.connectedPlayers.get(id)?.username,
        ),
      }),
    );

    const playerList = Array.from(this.connectedPlayers.values()).map((p) => ({
      username: p.username,
      inRoom: !!p.roomId,
    }));

    this.server.emit("lobbyUpdate", { roomList, playerList });
  }

  /** 특정 방에 있는 모든 유저에게 해당 방의 최신 정보를 브로드캐스트합니다. */
  private broadcastRoomInfo(roomId: string) {
    const room = this.roomsMetadata.get(roomId);
    if (!room) return;

    const roomInfo = {
      roomId,
      hostId: room.hostId,
      players: Array.from(room.playerIds).map((id) => ({
        id,
        username: this.connectedPlayers.get(id)?.username,
      })),
      gameStarted: room.gameStarted,
      readyPlayers: Array.from(room.readyPlayers),
    };
    this.server.to(roomId).emit("roomInfoUpdate", roomInfo);
  }

  /** 특정 방에 있는 모든 유저에게 최신 게임 상태를 각자의 시점에 맞게 전송합니다. */
  private broadcastGameState(roomId: string) {
    const game = this.gameService.getGame(roomId);
    const room = this.roomsMetadata.get(roomId);
    if (!game || !room) return;

    for (const playerId of room.playerIds) {
      const socketId = this.connectedPlayers.get(playerId)?.socketId;
      if (socketId) {
        this.server
          .to(socketId)
          .emit("gameStateUpdate", game.getGameState(playerId));
      }
    }
  }

  /** 특정 플레이어에게 행동을 요청합니다. (예: 턴 시작, 선택 요청) */
  private promptPlayer(playerId: string, event: string, data: unknown = {}) {
    const socketId = this.connectedPlayers.get(playerId)?.socketId;
    if (socketId) {
      if (typeof data === "object" && data !== null) {
        this.server.to(socketId).emit(event, data);
      } else {
        this.server.to(socketId).emit(event, {}); // Emit empty object if data is not an object
      }
    }
  }
}
