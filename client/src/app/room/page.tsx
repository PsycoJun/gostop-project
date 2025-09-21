'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Users, Play } from 'lucide-react';
import styles from './page.module.css';

function RoomPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('id');

  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [showGameBoard, setShowGameBoard] = useState(false);
  // 현재 유저의 준비 상태를 관리하는 로컬 상태
  const [isReady, setIsReady] = useState(false);

  // Helper to check if a player is ready from the server state
  const isPlayerReady = (playerId: string) => room?.readyPlayers?.includes(playerId);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!token || !roomId) return;

    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      path: '/socket.io/',
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('joinRoom', roomId);
    });

    newSocket.on('roomInfoUpdate', (roomInfo) => {
      setRoom(roomInfo);
      if (roomInfo.gameStarted) {
        setShowGameBoard(true);
      } else {
        setShowGameBoard(false);
        // 서버 상태와 로컬 isReady 상태 동기화
        if (user?.userId) {
          setIsReady(roomInfo.readyPlayers?.includes(user.userId));
        }
      }
    });

    newSocket.on('gameStarted', () => {
      setShowGameBoard(true);
    });

    newSocket.on('gameError', (message) => {
      alert(`Error: ${message}`);
      router.push('/lobby');
    });

    return () => {
      newSocket.emit('leaveRoom');
      newSocket.disconnect();
    };
  }, [user, loading, token, roomId, router]);

  const handleStartGame = () => {
    socket?.emit('startGame');
  };

  // 준비/준비취소 상태를 토글하는 함수
  const handleToggleReady = () => {
    const newReadyState = !isReady;
    if (newReadyState) {
      socket?.emit('readyGame');
    } else {
      socket?.emit('cancelReadyGame'); // 서버에 'cancelReadyGame' 이벤트 전송
    }
    setIsReady(newReadyState); // 로컬 상태 즉시 업데이트
  };

  const handleBackToLobby = () => {
    router.push('/lobby');
  };

  useEffect(() => {
    if (room && user) {
      console.log("--- ID DEBUGGING ---");
      console.log("Auth User Object (from useAuth):", user);
      console.log("Room Players Array (from server):", room.players);
      const me = room.players.find((p: any) => p.id === user.userId);
      console.log("Result of finding 'me' in players array:", me);
      console.log("--------------------");
    }
  }, [room, user]);

  if (loading || !user || !room) { // room 데이터가 로드될 때까지 로딩 표시
    return <div>Loading...</div>;
  }

  const isHost = room?.hostId === user?.userId;
  console.log('v1.7 Code Running! Is Host:', isHost);
  const host = room?.players?.find((p: any) => p.id === room.hostId);

  // 방장을 제외한 모든 플레이어가 준비되었는지 확인
  const allPlayersReady = room.players.length > 1 && room.readyPlayers.length === room.players.length - 1;

  // 게임 보드 UI
  if (showGameBoard) {
    const otherPlayers = room?.players?.filter((p: any) => p.id !== user?.userId) || [];
    const playerTop = otherPlayers[0];
    const playerLeft = otherPlayers[1];
    const playerRight = otherPlayers[2];

    return (
      <div className={styles.gameBoardContainer}>
        {/* Top Player Area (Player 2) */}
        {playerTop && (
          <div className={styles.playerAreaTop}>
            <div className={styles.playerInfoTop}>
              <Avatar className={styles.playerAvatar}>
                <AvatarFallback className={styles.playerAvatarFallback}>{playerTop.username[0]}</AvatarFallback>
              </Avatar>
              <span className={styles.playerName}>{playerTop.username}</span>
              {room.hostId === playerTop.id && <span className={styles.hostCrown}>👑</span>}
              {isPlayerReady(playerTop.id) && <span className={styles.readyCheckmark}>✅</span>}
            </div>
            <div className={styles.playerScoreBoard}>
              <div className={styles.scoreItem}>광: 0</div>
              <div className={styles.scoreItem}>열: 0</div>
              <div className={styles.scoreItem}>띠: 0</div>
              <div className={styles.scoreItem}>피: 0</div>
              <div className={styles.currentScore}>점수: 0</div>
              <div className={styles.budget}>잔고: ₩0</div>
            </div>
          </div>
        )}

        {/* Main Game Area */}
        <div className={styles.mainGameArea}>
          {/* Left Player Area (Player 3) */}
          {playerLeft && (
            <div className={styles.playerAreaLeft}>
              <div className={styles.playerInfoSide}>
                <Avatar className={styles.playerAvatar}>
                  <AvatarFallback className={styles.playerAvatarFallback}>{playerLeft.username[0]}</AvatarFallback>
                </Avatar>
                <span className={styles.playerName}>{playerLeft.username}</span>
                {room.hostId === playerLeft.id && <span className={styles.hostCrown}>👑</span>}
                {isPlayerReady(playerLeft.id) && <span className={styles.readyCheckmark}>✅</span>}
              </div>
              <div className={styles.playerScoreBoard}>
                <div className={styles.scoreItem}>광: 0</div>
                <div className={styles.scoreItem}>열: 0</div>
                <div className={styles.scoreItem}>띠: 0</div>
                <div className={styles.scoreItem}>피: 0</div>
                <div className={styles.currentScore}>점수: 0</div>
                <div className={styles.budget}>잔고: ₩0</div>
              </div>
            </div>
          )}

          {/* Center Board Area */}
          <div className={styles.centerBoardArea}>
            <div className={styles.floorCardsArea}>
              {/* Placeholder for floor cards */}
              <div className={styles.cardPlaceholder}>바닥 카드</div>
            </div>
            <div className={styles.handCardsArea}>
              {/* Placeholder for hand cards */}
              <div className={styles.cardPlaceholder}>손패 카드</div>
            </div>
          </div>

          {/* Right Player Area (Player 4) */}
          {playerRight && (
            <div className={styles.playerAreaRight}>
              <div className={styles.playerInfoSide}>
                <Avatar className={styles.playerAvatar}>
                  <AvatarFallback className={styles.playerAvatarFallback}>{playerRight.username[0]}</AvatarFallback>
                </Avatar>
                <span className={styles.playerName}>{playerRight.username}</span>
                {room.hostId === playerRight.id && <span className={styles.hostCrown}>👑</span>}
                {isPlayerReady(playerRight.id) && <span className={styles.readyCheckmark}>✅</span>}
              </div>
              <div className={styles.playerScoreBoard}>
                <div className={styles.scoreItem}>광: 0</div>
                <div className={styles.scoreItem}>열: 0</div>
                <div className={styles.scoreItem}>띠: 0</div>
                <div className={styles.scoreItem}>피: 0</div>
                <div className={styles.currentScore}>점수: 0</div>
                <div className={styles.budget}>잔고: ₩0</div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Player Area (Current User) */}
        <div className={styles.playerAreaBottom}>
          <div className={styles.playerInfoBottom}>
            <Avatar className={styles.playerAvatar}>
              <AvatarFallback className={styles.playerAvatarFallback}>{user?.username[0]}</AvatarFallback>
            </Avatar>
            <span className={styles.playerName}>{user?.username} (You)</span>
            {room.hostId === user?.userId && <span className={styles.hostCrown}>👑</span>}
            {isPlayerReady(user?.userId) && <span className={styles.readyCheckmark}>✅</span>}
          </div>
          <div className={styles.playerScoreBoard}>
            <div className={styles.scoreItem}>광: 0</div>
            <div className={styles.scoreItem}>열: 0</div>
            <div className={styles.scoreItem}>띠: 0</div>
            <div className={styles.scoreItem}>피: 0</div>
            <div className={styles.currentScore}>점수: 0</div>
            <div className={styles.budget}>잔고: ₩{user?.budget || 0}</div>
          </div>
          {/* Host/Ready Button */}
          {isHost ? (
            <Button
              className={`${styles.buttonBase} ${styles.startGameButton}`}
              onClick={handleStartGame}
            >
              게임시작
            </Button>
          ) : (
            <Button
              className={`${styles.buttonBase} ${styles.readyButton}`}
              onClick={handleToggleReady}
            >
              준비
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 대기실 UI
  return (
    <div className={styles.roomContainer}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            {/* 나가기 버튼은 로직상 아래로 이동 */}
            <Button onClick={handleBackToLobby} variant="ghost" size="sm" className={styles.backButton} disabled={!isHost && isReady}>
              <ArrowLeft className={styles.backIcon} />
            </Button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 className={styles.roomTitle}>{host?.username}의 방</h1>
                <Badge variant="secondary">v2.2</Badge>
              </div>
              <p className={styles.roomStatus}>Waiting for players</p>
            </div>
          </div>
          <Badge variant="secondary" className={styles.playerCountBadge}>
            <Users className={styles.playerCountIcon} />
            {room?.players?.length || 0}/4
          </Badge>
        </div>
      </div>

      <div className={styles.mainContent}>
        <Card className={styles.playersCard}>
          <CardContent className={styles.playersCardContent}>
            <h3 className={styles.playersTitle}>Players</h3>
            <div className={styles.playerList}>
              {room?.players?.map((p: any) => (
                <div key={p.id} className={styles.playerItem}>
                  <div className={styles.playerInfo}>
                    <Avatar className={styles.avatar}>
                      <AvatarFallback className={styles.avatarFallback}>{p.username[0]}</AvatarFallback>
                    </Avatar>
                    <span className={styles.playerName}>
                      {p.username} {p.id === user.userId ? '(You)' : ''}
                      {room.hostId === p.id ? ' 👑' : ''}
                      {isPlayerReady(p.id) && p.id !== room.hostId && ' ✅'}
                    </span>
                  </div>
                  {/* 준비 상태 텍스트는 아이콘으로 대체 */}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className={styles.buttonsSection}>
          {isHost ? (
            <>
              <Button
                onClick={handleStartGame}
                className={`${styles.buttonBase} ${styles.startGameButton}`}
                disabled={!allPlayersReady}
              >
               <Play className={styles.startGameIcon} />
                게임시작
              </Button>
              <Button
                onClick={handleBackToLobby}
                variant="outline"
                className={styles.exitButton}
              >
                나가기
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleToggleReady}
                className={`${styles.buttonBase} ${styles.readyButton}`}
              >
                {isReady ? '준비취소' : '준비완료'}
              </Button>
              <Button
                onClick={handleBackToLobby}
                variant="outline"
                className={styles.exitButton}
                disabled={isReady}
              >
                나가기
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RoomPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RoomPage />
    </Suspense>
  );
}

