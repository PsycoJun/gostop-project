// gostop-project/server/src/game/entities/player.entity.ts

import { Card } from "./card.entity";

/**
 * 플레이어의 상태와 동작을 정의하는 클래스
 */
export class Player {
  id: string;
  name: string;
  budget: number;

  hand: Card[] = [];
  collectedCards: Card[] = [];
  revealedCards: Card[] = []; // 흔들어서 공개된 패

  shakingCount = 0;
  bombCount = 0;
  goCount = 0;
  lastGoScore = 0; // '고'를 외쳤을 당시의 점수

  voluntarilyFolded = false; // 자발적으로 '다이' 했는지 여부
  gukjinAsPi = false; // 국진을 쌍피로 사용했는지 여부
  gukjinChoiceMade = false;

  constructor(id: string, name: string, initialBudget: number) {
    this.id = id;
    this.name = name;
    this.budget = initialBudget;
  }

  /**
   * 새로운 라운드를 위해 플레이어의 상태를 초기화합니다.
   */
  resetForNewRound(): void {
    this.hand = [];
    this.collectedCards = [];
    this.revealedCards = [];
    this.shakingCount = 0;
    this.bombCount = 0;
    this.goCount = 0;
    this.lastGoScore = 0;
    this.gukjinAsPi = false;
    this.gukjinChoiceMade = false;
    // 'voluntarilyFolded'는 라운드가 아닌 게임 전체에 걸쳐 유지될 수 있으므로 여기서 초기화하지 않음
  }

  /**
   * 패 분배 직후 '총통' 여부를 확인합니다.
   * @returns 총통이면 true, 아니면 false
   */
  hasChongtong(): boolean {
    const monthCounts = this.hand.reduce(
      (acc, card) => {
        if (card.month) {
          acc[card.month] = (acc[card.month] || 0) + 1;
        }
        return acc;
      },
      {} as Record<number, number>,
    );

    return Object.values(monthCounts).some((count) => count === 4);
  }
}
