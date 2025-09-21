// gostop-project/server/src/game/game.service.ts
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { GoStopCore } from "./logic/game.core";
import { User, UserDocument } from "../user/user.schema";

@Injectable()
export class GameService {
  public rooms = new Map<string, GoStopCore>();

  // NestJS의 의존성 주입을 통해 UserModel을 주입받음
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async createRoom(roomId: string, playerIds: string[]) {
    console.log(`[GameService] createRoom called for roomId: ${roomId}, playerIds: ${playerIds}`);
    const playersData = await this.getPlayersData(playerIds);

    if (this.rooms.has(roomId)) {
      console.warn(`[GameService] createRoom warning: Game instance for room ${roomId} already exists.`);
      throw new Error("Room already exists.");
    }
    const game = new GoStopCore(playersData);
    this.rooms.set(roomId, game);
    console.log(`[GameService] Game instance created and stored for roomId: ${roomId}`);
    return game;
  }
  deleteRoom(roomId: string): void {
    const deleted = this.rooms.delete(roomId);
    if (deleted) {
      console.log(`🧹 [Game Service] Game instance for room ${roomId} deleted.`);
    }
  }
  /**
   * DB에서 여러 플레이어의 정보를 조회하여 게임 시작에 필요한 데이터 형식으로 반환합니다.
   */
  async getPlayersData(
    playerIds: string[],
  ): Promise<{ id: string; name: string; budget: number }[]> {
    const users = await this.userModel.find({ _id: { $in: playerIds } }).exec();
    return users.map((user) => ({
      id: user.id,
      name: user.username,
      budget: user.budget,
    }));
  }

  /**
   * 게임이 끝난 후, 계산된 점수를 DB에 업데이트합니다.
   * @param payouts - GoStopCore가 계산한 플레이어별 예산 변동 내역
   */
  async updatePlayerBudgets(payouts: { playerId: string; amount: number }[]) {
    const operations = payouts.map((payout) => ({
      updateOne: {
        filter: { _id: payout.playerId },
        update: { $inc: { budget: payout.amount } },
      },
    }));
    await this.userModel.bulkWrite(operations);
  }

  startGame(roomId: string): { nextPlayerId: string | null } {
    console.log(`[GameService] startGame called for roomId: ${roomId}`);
    // Placeholder implementation
    const game = this.rooms.get(roomId);
    if (!game) {
      console.error(`[GameService] startGame error: Game instance for room ${roomId} not found.`);
      throw new Error("Game not found");
    }

    const result = game.setupRound();
    console.log(`[GameService] Game setupRound completed for roomId: ${roomId}`);
    return { nextPlayerId: result.promptPlayerId };
  }

  getGame(roomId: string): GoStopCore | undefined {
    return this.rooms.get(roomId);
  }
}
