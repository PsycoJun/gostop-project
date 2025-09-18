// gostop-project/server/src/game/entities/card.entity.ts

export type CardType =
  | "gwang"
  | "tti"
  | "pi"
  | "yul"
  | "ssangpi"
  | "bonus"
  | "bomb_special";

/**
 * 화투패 한 장의 데이터 구조를 정의하는 인터페이스
 */
export interface Card {
  month: number | null;
  type: CardType;
  name: string;
  id: string; // 카드 인스턴스별 고유 ID
  isPpuk?: boolean;
}

/**
 * 게임 중 동적으로 생성되는 폭탄패의 기본 형태
 */
export const BOMB_CARD: Omit<Card, "id"> = {
  month: null,
  type: "bomb_special",
  name: "폭탄패",
};
