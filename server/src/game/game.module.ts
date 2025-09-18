// gostop-project/server/src/game/game.module.ts
import { Module } from "@nestjs/common";
import { GameGateway } from "./game.gateway";
import { GameService } from "./game.service";
import { UserModule } from "../user/user.module"; // UserModule import

@Module({
  imports: [UserModule], // UserModel을 사용하기 위해 UserModule을 import
  providers: [GameGateway, GameService],
})
export class GameModule {}
