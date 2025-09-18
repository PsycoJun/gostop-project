// gostop-project/server/src/game/logic/deck.logic.ts
import { v4 as uuidv4 } from "uuid";
import { Card } from "../entities/card.entity";

// 카드 덱의 원본 데이터. Omit을 사용하여 id는 런타임에 생성되도록 함.
const CARD_DECK_TEMPLATE: Omit<Card, "id">[] = [
  // 1월 (송학)
  { month: 1, type: "gwang", name: "1월 광 (송학)" },
  { month: 1, type: "tti", name: "1월 띠 (홍단)" },
  { month: 1, type: "pi", name: "1월 피1" },
  { month: 1, type: "pi", name: "1월 피2" },
  // 2월 (매조)
  { month: 2, type: "yul", name: "2월 십 (고도리)" },
  { month: 2, type: "tti", name: "2월 띠 (홍단)" },
  { month: 2, type: "pi", name: "2월 피1" },
  { month: 2, type: "pi", name: "2월 피2" },
  // 3월 (벚꽃)
  { month: 3, type: "gwang", name: "3월 광 (벚꽃)" },
  { month: 3, type: "tti", name: "3월 띠 (홍단)" },
  { month: 3, type: "pi", name: "3월 피1" },
  { month: 3, type: "pi", name: "3월 피2" },
  // 4월 (흑싸리)
  { month: 4, type: "yul", name: "4월 십 (고도리)" },
  { month: 4, type: "tti", name: "4월 띠 (초단)" },
  { month: 4, type: "pi", name: "4월 피1" },
  { month: 4, type: "pi", name: "4월 피2" },
  // 5월 (난초)
  { month: 5, type: "ssangpi", name: "5월 십 (초약)" },
  { month: 5, type: "tti", name: "5월 띠 (초단)" },
  { month: 5, type: "pi", name: "5월 피1" },
  { month: 5, type: "pi", name: "5월 피2" },
  // 6월 (모란)
  { month: 6, type: "yul", name: "6월 십 (청약)" },
  { month: 6, type: "tti", name: "6월 띠 (청단)" },
  { month: 6, type: "pi", name: "6월 피1" },
  { month: 6, type: "pi", name: "6월 피2" },
  // 7월 (홍싸리)
  { month: 7, type: "yul", name: "7월 십 (홍약)" },
  { month: 7, type: "tti", name: "7월 띠 (초단)" },
  { month: 7, type: "pi", name: "7월 피1" },
  { month: 7, type: "pi", name: "7월 피2" },
  // 8월 (공산)
  { month: 8, type: "gwang", name: "8월 광 (공산)" },
  { month: 8, type: "yul", name: "8월 십 (고도리)" },
  { month: 8, type: "pi", name: "8월 피1" },
  { month: 8, type: "pi", name: "8월 피2" },
  // 9월 (국화)
  { month: 9, type: "yul", name: "9월 십 (국진)" },
  { month: 9, type: "tti", name: "9월 띠 (청단)" },
  { month: 9, type: "pi", name: "9월 피1" },
  { month: 9, type: "pi", name: "9월 피2" },
  // 10월 (단풍)
  { month: 10, type: "yul", name: "10월 십 (청약)" },
  { month: 10, type: "tti", name: "10월 띠 (청단)" },
  { month: 10, type: "pi", name: "10월 피1" },
  { month: 10, type: "pi", name: "10월 피2" },
  // 11월 (오동)
  { month: 11, type: "gwang", name: "11월 광 (똥광)" },
  { month: 11, type: "ssangpi", name: "11월 쌍피" },
  { month: 11, type: "pi", name: "11월 피1" },
  { month: 11, type: "pi", name: "11월 피2" },
  // 12월 (비)
  { month: 12, type: "gwang", name: "12월 광 (비광)" },
  { month: 12, type: "yul", name: "12월 십" },
  { month: 12, type: "tti", name: "12월 띠 (비띠)" },
  { month: 12, type: "ssangpi", name: "12월 쌍피" },
  // 보너스 패
  { month: null, type: "bonus", name: "보너스 쌍피1" },
  { month: null, type: "bonus", name: "보너스 쌍피2" },
  { month: null, type: "bonus", name: "보너스 쌍피3" },
];

export class Deck {
  private cards: Card[];

  constructor() {
    this.cards = CARD_DECK_TEMPLATE.map((card) => ({ ...card, id: uuidv4() }));
    this.shuffle();
  }

  shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw(count: number): Card[] {
    if (count > this.cards.length) {
      return this.cards.splice(0, this.cards.length);
    }
    return this.cards.splice(0, count);
  }

  pop(): Card | undefined {
    return this.cards.pop();
  }

  get length(): number {
    return this.cards.length;
  }

  add(cards: Card[]): void {
    this.cards.push(...cards);
  }
}
