import { v4 as uuidv4 } from "uuid";
import { Card, BOMB_CARD } from "../entities/card.entity";
import { Player } from "../entities/player.entity";
import { Deck } from "./deck.logic";

export interface PendingChoice {
  playerId: string;
  type: "select_from_floor";
  playedCard: Card;
  flippedCard: Card;
  options: Card[];
}

export class GoStopCore {
  public players: Player[];
  public deck: Deck;
  public floorCards: Card[] = [];
  public dealer: Player;
  public activePlayers: Player[] = [];
  public participants: Player[] = [];
  public forcedSitter: Player | null = null;
  public nagariMultiplier = 1;
  public drawMultiplier = 1;
  public pendingChoice: PendingChoice | null = null;
  public gukjinChoicePendingForPlayerId: string | null = null;
  public shakingChoice: { playerId: string; cardToPlay: Card } | null = null;
  public bombChoice: { playerId: string; cardToPlay: Card } | null = null;
  public shakeOrBombPending: {
    type: "shake" | "bomb";
    playerId: string;
    cardToPlay: Card;
  } | null = null;

  public roundEnded = false;
  public lastWinner: Player | null = null;

  private roundEvents: any[] = [];
  private lastGoPlayerId: string | null = null;
  private participationDecisionQueue: Player[] = [];

  constructor(playersData: { id: string; name: string; budget: number }[]) {
    this.players = playersData.map(
      (data) => new Player(data.id, data.name, data.budget),
    );
    this.deck = new Deck();
    this.dealer = this.players[0];
    this.lastWinner = this.dealer;
  }

  public getGameState(requestingPlayerId?: string) {
    const gameState = {
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        budget: p.budget,
        hand: p.id === requestingPlayerId ? p.hand : [],
        handSize: p.hand.length,
        collectedCards: p.collectedCards,
        revealedCards: p.revealedCards,
        scoreDetails: this.calculateScore(p),
        isDealer: p.id === this.dealer.id,
        goCount: p.goCount,
        shakingCount: p.shakingCount,
        bombCount: p.bombCount,
        voluntarilyFolded: p.voluntarilyFolded,
      })),
      floorCards: this.floorCards,
      deckSize: this.deck.length,
      activePlayerIds: this.activePlayers.map((p) => p.id),
      currentPlayerId: this.isParticipationPhaseOver()
        ? this.activePlayers[0]?.id
        : this.participationDecisionQueue[0]?.id,
      pendingChoice: this.pendingChoice,
      gukjinChoicePendingForPlayerId: this.gukjinChoicePendingForPlayerId,
      shakeOrBombPending: this.shakeOrBombPending,
      roundEnded: this.roundEnded,
      lastWinnerId: this.lastWinner?.id,
      drawMultiplier: this.nagariMultiplier,
      events: this.roundEvents,
    };
    this.clearEvents();
    return gameState;
  }

  private isParticipationPhaseOver(): boolean {
    return this.participationDecisionQueue.length === 0;
  }

  private clearEvents(): void {
    this.roundEvents = [];
  }

  setupRound(): { promptPlayerId: string | null; roundOver: boolean } {
    console.log("\n" + "-".repeat(20));
    console.log(
      `새로운 라운드를 시작합니다. (선: ${this.dealer.name}, 현재 나가리 배수: ${this.nagariMultiplier}배)`,
    );
    console.log("-".repeat(20));

    this.deck = new Deck();
    console.log(`[setupRound] New deck created. Size: ${this.deck.length}`);
    this.floorCards = [];
    this.participants = [];
    this.forcedSitter = null;
    this.pendingChoice = null;
    this.lastGoPlayerId = null; // Reset at start of round

    this.players.forEach((p) => {
      p.resetForNewRound();
      console.log(
        `[setupRound] Player ${p.name}'s hand after resetForNewRound:`,
        p.hand.map((c) => c.name),
      );
    });

    this.players.forEach((p) => {
      console.log(
        `[setupRound] Drawing 7 cards for ${p.name}. Deck size before draw: ${this.deck.length}`,
      );
      p.hand = this.deck.draw(7);
      console.log(
        `[setupRound] ${p.name}'s hand size: ${p.hand.length}. Deck size after draw: ${this.deck.length}. Hand:`,
        p.hand.map((c) => c.name),
      );
    });

    console.log(
      `[setupRound] Drawing 6 cards for floor. Deck size before draw: ${this.deck.length}`,
    );
    this.floorCards = this.deck.draw(6);
    console.log(
      `[setupRound] Floor cards size: ${this.floorCards.length}. Deck size after draw: ${this.deck.length}`,
    );

    console.log("모든 플레이어에게 카드를 7장씩 분배했습니다.");

    for (const player of this.players) {
      if (player.hasChongtong()) {
        console.log(`!!! ${player.name}님, '총통'입니다!!!`);
        // this.endRound(player, false); // Revisit when implementing endRound
        // return { promptPlayerId: player.id, roundOver: true }; // Revisit when implementing endRound
      }
    }

    this.participants = [this.dealer];
    const dealerIndex = this.players.findIndex((p) => p.id === this.dealer.id);
    const playersAfterDealer = this.players.slice(dealerIndex + 1);
    const playersBeforeDealer = this.players.slice(0, dealerIndex);
    this.participationDecisionQueue = [
      ...playersAfterDealer,
      ...playersBeforeDealer,
    ];
    console.log(`선(${this.dealer.name})님이 자동으로 참가했습니다.`);

    return this.promptNextParticipantInQueue();
  }

  handleParticipationDecision(
    playerId: string,
    decision: "call" | "fold",
  ): { promptPlayerId: string | null; roundOver: boolean } {
    const playerIndex = this.participationDecisionQueue.findIndex(
      (p) => p.id === playerId,
    );
    if (playerIndex !== 0) {
      return {
        promptPlayerId: this.participationDecisionQueue[0]?.id || null,
        roundOver: false,
      };
    }
    const player = this.participationDecisionQueue.shift()!;

    // NEW LOGIC: If player previously folded, they can only 'call'
    let finalDecision = decision;
    if (player.voluntarilyFolded && decision === "fold") {
      console.log(
        `${player.name}님은 이전 라운드에서 다이했으므로, 이번 라운드에서는 자동으로 '콜' 처리됩니다.`,
      );
      finalDecision = "call";
    }

    if (finalDecision === "call") {
      this.participants.push(player);
      console.log(`${player.name}님이 '콜'을 선택했습니다.`);
      player.voluntarilyFolded = false; // Clear the flag if they call
    } else {
      // finalDecision is 'fold'
      player.voluntarilyFolded = true;
      console.log(`${player.name}님이 '다이'를 선택했습니다.`);
      if (this.participationDecisionQueue.length > 0) {
        console.log("한 명이 다이하여 나머지 플레이어는 자동 콜 처리됩니다.");
        this.participants.push(...this.participationDecisionQueue);
        this.participationDecisionQueue = [];
      }
    }
    return this.promptNextParticipantInQueue();
  }

  finalizeParticipants(): void {
    const nonParticipants = this.players.filter(
      (p) => !this.participants.includes(p),
    );
    if (nonParticipants.length > 0) {
      console.log(`
--- 비참가자 패 반납 ---`);
      nonParticipants.forEach((p) => {
        console.log(
          `[finalizeParticipants] Deck size before add: ${this.deck.length}`,
        );
        this.deck.add(p.hand);
        console.log(
          `[finalizeParticipants] Deck size after add: ${this.deck.length}`,
        );
        p.hand = [];
      });
      this.deck.shuffle();
    }
    this.handleFloorBonusCards();
    console.log(
      "게임을 시작합니다. 참가자: ",
      this.participants.map((p) => p.name).join(", "),
    );
  }
  public makeGoStopDecision(playerId: string, decision: 'go' | 'stop'): void {
    const player = this.findPlayer(playerId);

    if (decision === 'go') {
      player.goCount++;
      this.lastGoPlayerId = player.id;
      this.roundEvents.push({
        type: 'go',
        playerId: player.id,
        username: player.name,
        goCount: player.goCount,
      });
      // '고'를 했으므로, 다음 플레이어에게 턴이 넘어갑니다.
      // (GameService와 Gateway가 이 상태를 보고 턴을 넘겨줄 것입니다.)

    } else { // decision is 'stop'
      this.roundEnded = true;
      this.lastWinner = player;
      this.roundEvents.push({
        type: 'stop',
        playerId: player.id,
        username: player.name,
      });
      // '스톱'을 했으므로, 라운드가 종료됩니다.
      // (GameService가 이 상태를 보고 calculateRoundResult를 호출할 것입니다.)
    }
  }

  private promptNextParticipantInQueue(): {
    promptPlayerId: string | null;
    roundOver: boolean;
  } {
    if (
      this.participationDecisionQueue.length === 0 ||
      this.participants.length >= 3
    ) {
      while (
        this.participants.length >= 3 &&
        this.participationDecisionQueue.length > 0
      ) {
        const sitter = this.participationDecisionQueue.shift()!;
        this.forcedSitter = sitter;

        console.log(`강제 시터: ${sitter.name} (광팔기)`);
        this.handleGwangPalgi(sitter);
      }
      this.finalizeParticipants();
      return { promptPlayerId: null, roundOver: this.participants.length < 2 };
    }

    const nextPlayer = this.participationDecisionQueue[0];
    console.log(`
--- 참가자 결정: ${nextPlayer.name}님의 차례 ---`);
    return { promptPlayerId: nextPlayer.id, roundOver: false };
  }

  /**
   * 턴을 진행합니다.
   * @param playerId - 턴을 진행하는 플레이어 ID
   * @param cardToPlay - 손에서 낼 카드
   * @param chosenCardName - 바닥에 같은 월 패가 2장 있을 경우 선택한 카드의 이름
   */
  public playTurn(
    playerId: string,
    cardToPlay: Card,
    chosenCardName?: string,
  ): void {
    const player = this.findPlayer(playerId);

    if (this.pendingChoice?.playerId === playerId && chosenCardName) {
      this.resolveChoice(player, chosenCardName);
      return;
    }

    if (cardToPlay.type === "bonus") {
      this.playBonusCardFromHand(player, cardToPlay);
      return;
    }

    if (cardToPlay.type === "bomb_special") {
      const handCardIndex = player.hand.findIndex(
        (c) => c.name === cardToPlay.name,
      );
      if (handCardIndex > -1) player.hand.splice(handCardIndex, 1);
      this.flipCardAndEndTurn(player);
      return;
    }

    const sameMonthCardsInHand = player.hand.filter(
      (c) => c.month === cardToPlay.month,
    );
    const floorMatchCount = this.floorCards.filter(
      (c) => c.month === cardToPlay.month,
    ).length;

    if (sameMonthCardsInHand.length === 3 && floorMatchCount >= 1) {
      this.shakeOrBombPending = { type: "bomb", playerId, cardToPlay };
      return;
    }
    if (sameMonthCardsInHand.length >= 3 && floorMatchCount === 0) {
      this.shakeOrBombPending = { type: "shake", playerId, cardToPlay };
      return;
    }

    this.proceedWithTurn(player, cardToPlay);
  }

  private proceedWithTurn(player: Player, cardToPlay: Card): void {
    const handCardIndex = player.hand.findIndex((c) => c.id === cardToPlay.id);
    if (handCardIndex === -1) throw new Error("Card not in player's hand");
    player.hand.splice(handCardIndex, 1);

    const matches = this.floorCards.filter((c) => c.month === cardToPlay.month);
    const flippedCard = this.deck.pop();

    // 🔽 덱에 카드가 없어 뒤집을 수 없는 경우 (processPlayedCardOnly 로직 통합) 🔽
    if (!flippedCard) {
      if (matches.length === 0) {
        this.floorCards.push(cardToPlay);
      } else {
        const collected = [cardToPlay, ...matches];
        this.floorCards = this.floorCards.filter(c => c.month !== cardToPlay.month);
        this.collectCards(player, collected);
      }
      this.checkGoStopCondition(player);
      return;
    }

    const finalFlippedCard = this.processBonusCardsRecursive(player, flippedCard);

    // 🔽 보너스 처리 후 뒤집을 카드가 없는 경우 (processPlayedCardOnly 로직 통합) 🔽
    if (!finalFlippedCard) {
      if (matches.length === 0) {
        this.floorCards.push(cardToPlay);
      } else {
        const collected = [cardToPlay, ...matches];
        this.floorCards = this.floorCards.filter(c => c.month !== cardToPlay.month);
        this.collectCards(player, collected);
      }
      this.checkGoStopCondition(player);
      return;
    }

    // 냈던 패와 뒤집은 패가 같은 월일 때 (쪽, 따닥, 뻑)
    if (cardToPlay.month === finalFlippedCard.month) {
      this.handleJjokTtaPpuk(player, cardToPlay, finalFlippedCard, matches);
    } else {
      this.handleNormalTurn(player, cardToPlay, matches, finalFlippedCard);
    }

    // 선택지가 발생하지 않았을 경우에만 고/스톱 확인
    if (!this.pendingChoice) {
      this.checkGoStopCondition(player);
    }
  }
  public handleShakingChoice(playerId: string, decision: boolean): void {
    if (!this.shakingChoice || this.shakingChoice.playerId !== playerId)
      throw new Error("Invalid player or no shaking choice required.");
    const player = this.players.find((p) => p.id === playerId)!;
    const { cardToPlay } = this.shakingChoice;
    if (decision) {
      console.log(`${player.name}님이 흔들기를 선택했습니다.`);
      player.shakingCount++;
      const otherCards = player.hand.filter(
        (c) => c.month === cardToPlay.month && c.name !== cardToPlay.name,
      );
      player.revealedCards.push(...otherCards);
    } else {
      console.log(`${player.name}님이 흔들기를 선택하지 않았습니다.`);
    }
    this.shakingChoice = null;
    this.proceedWithTurn(player, cardToPlay);
  }

  public handleBombChoice(playerId: string, decision: boolean): void {
    if (!this.bombChoice || this.bombChoice.playerId !== playerId)
      throw new Error("Invalid player or no bomb choice required.");
    const player = this.players.find((p) => p.id === playerId)!;
    const { cardToPlay } = this.bombChoice;
    this.bombChoice = null;

    if (decision) {
      console.log(`${player.name}님이 폭탄을 선택했습니다.`);
      player.bombCount++;
      const cardsToBomb = player.hand.filter(
        (c) => c.month === cardToPlay.month,
      );
      player.hand = player.hand.filter((c) => c.month !== cardToPlay.month);

      const matchesOnFloor = this.floorCards.filter(
        (c) => c.month === cardToPlay.month,
      );
      this.floorCards = this.floorCards.filter(
        (c) => c.month !== cardToPlay.month,
      );

      const collected = [...cardsToBomb, ...matchesOnFloor];
      this.collectCards(player, collected);
      console.log(
        `${player.name}님이 ${collected.map((c) => c.name).join(", ")} 카드를 획득했습니다.`,
      );

      this.takePiFromOthers(player, 1);

      player.hand.push(
        { ...BOMB_CARD, id: uuidv4() },
        { ...BOMB_CARD, id: uuidv4() },
      );
      console.log(
        `${player.name}님이 폭탄패 2장을 받았습니다. Hand:`,
        player.hand.map((c) => c.name),
      );

      this.flipCardAndEndTurn(player);
    } else {
      console.log(`${player.name}님이 폭탄을 선택하지 않았습니다.`);
      this.proceedWithTurn(player, cardToPlay);
    }
  }

  private flipCardAndEndTurn(player: Player): void {
    const flippedCard: Card | undefined = this.deck.pop();
    if (!flippedCard) {
      this.checkGoStopCondition(player);
      return;
    }
    const finalFlippedCard = this.processBonusCardsRecursive(
      player,
      flippedCard,
    );
    if (finalFlippedCard) {
      this.processFlippedCard(player, finalFlippedCard);
    }

    if (!this.pendingChoice) {
      this.checkGoStopCondition(player);
    }
  }

  private handleJjokTtaPpuk(
    player: Player,
    playedCard: Card,
    flippedCard: Card,
    matches: Card[],
  ) {
    let eventType = "";
    switch (matches.length) {
      case 0: // 쪽
        eventType = "jjok";
        this.collectCards(player, [playedCard, flippedCard]);
        this.takePiFromOthers(
          player,
          this.getPiCountForMatch(playedCard, flippedCard, []),
        );
        break;
      case 1: {
        // 뻑
        eventType = "ppuk";
        const matchCard = matches[0];
        this.floorCards = this.floorCards.filter((c) => c.id !== matchCard.id);
        playedCard.isPpuk = true;
        flippedCard.isPpuk = true;
        matchCard.isPpuk = true;
        this.floorCards.push(playedCard, flippedCard, matchCard);
        break;
      }
      case 2: {
        // 따닥
        eventType = "ttadak";
        const ttadakCards = [playedCard, flippedCard, ...matches];
        this.floorCards = this.floorCards.filter(
          (c) => c.month !== playedCard.month,
        );
        this.collectCards(player, ttadakCards);
        this.takePiFromOthers(
          player,
          this.getPiCountForMatch(playedCard, flippedCard, matches),
        );
        break;
      }
      default: {
        // 뻑 먹기
        eventType = "eat_ppuk";
        const collectedPpuk = [playedCard, flippedCard, ...matches];
        this.floorCards = this.floorCards.filter(
          (c) => c.month !== playedCard.month,
        );
        this.collectCards(player, collectedPpuk);
        this.takePiFromOthers(
          player,
          this.getPiCountForMatch(playedCard, flippedCard, matches),
        );
        break;
      }
    }
    this.roundEvents.push({
      type: eventType,
      playerId: player.id,
      username: player.name,
    });
  }

  private handleNormalTurn(
    player: Player,
    playedCard: Card,
    matches: Card[],
    flippedCard: Card,
  ) {
    // 1. 낸 카드 처리
    if (matches.length === 2) {
      this.pendingChoice = {
        type: "select_from_floor",
        playerId: player.id,
        playedCard,
        flippedCard,
        options: matches,
      };
      return; // 선택을 기다려야 하므로 턴 종료
    }
    if (matches.length === 0) {
      this.floorCards.push(playedCard);
    } else {
      // 1장 또는 3장(뻑)
      const collected = [playedCard, ...matches];
      this.floorCards = this.floorCards.filter(
        (c) => c.month !== playedCard.month,
      );
      this.collectCards(player, collected);
    }

    // 2. 뒤집은 카드 처리
    this.processFlippedCard(player, flippedCard);
  }

  private processFlippedCard(player: Player, flippedCard: Card) {
    const matches = this.floorCards.filter(
      (c) => c.month === flippedCard.month,
    );

    if (matches.length === 0) {
      this.floorCards.push(flippedCard);
    } else if (matches.length === 1) {
      const collected = [flippedCard, ...matches];
      this.floorCards = this.floorCards.filter(
        (c) => c.month !== flippedCard.month,
      );
      this.collectCards(player, collected);
    } else if (matches.length === 2) {
      this.pendingChoice = {
        type: "select_from_floor",
        playerId: player.id,
        playedCard: flippedCard,
        flippedCard: flippedCard,
        options: matches,
      };
      return; // Added return statement here
    } else {
      // 뻑 먹기
      const collected = [flippedCard, ...matches];
      this.floorCards = this.floorCards.filter(
        (c) => c.month !== flippedCard.month,
      );
      this.collectCards(player, collected);
      this.roundEvents.push({
        type: "eat_ppuk",
        playerId: player.id,
        username: player.name,
      });
    }
  }

  private resolveFloorChoice(player: Player, chosenCardName: string) {
    const choice = this.pendingChoice!;
    const chosenCard = choice.options.find((c) => c.name === chosenCardName)!;
    const unchosenCard = choice.options.find((c) => c.name !== chosenCardName)!;

    this.floorCards = this.floorCards.filter(
      (c) => c.id !== chosenCard.id && c.id !== unchosenCard.id,
    );
    this.collectCards(player, [choice.playedCard, chosenCard]);
    this.floorCards.push(unchosenCard);

    // 선택이 낸 카드에 대한 것이었으면, 원래 뒤집으려던 카드를 마저 처리
    const wasChoiceForPlayedCard =
      choice.playedCard.id !== choice.flippedCard.id;
    this.pendingChoice = null; // 선택 완료

    if (wasChoiceForPlayedCard) {
      this.processFlippedCard(player, choice.flippedCard);
    }

    // 모든 선택이 완료된 후 고/스톱 확인
    if (!this.pendingChoice) {
      this.checkGoStopCondition(player);
    }
  }

  // ... 기타 모든 필요한 메소드 (calculateScore 등) ...

  public calculateScore(player: Player): {
    baseScore: number;
    piCount: number;
    gwangCount: number;
    yulCount: number;
    ttiCount: number;
  } {
    // 기존 calculateScore 로직 (반환값 단순화)
    return {
      baseScore: 0,
      piCount: 0,
      gwangCount: 0,
      yulCount: 0,
      ttiCount: 0,
    };
  }

  /**
   * 라운드 결과를 계산합니다.
   */
  public calculateRoundResult(
    winner: Player | null,
    isDraw: boolean = false,
  ): {
    winnerId: string | null;
    payouts: { playerId: string; amount: number }[];
    isDraw: boolean;
  } {
    this.roundEnded = true;
    this.lastWinner = winner;

    const initialBudgets: { [id: string]: number } = {};
    this.players.forEach((p) => (initialBudgets[p.id] = p.budget));

    if (isDraw) {
      this.drawMultiplier *= 2;
      this.lastWinner = this.dealer;
      this.roundEvents.push({ type: 'draw', multiplier: this.drawMultiplier });
    } else if (winner) {
      const playerScores = new Map<Player, ReturnType<typeof this.calculateScore>>();
      this.activePlayers.forEach((p) => playerScores.set(p, this.calculateScore(p)));

      let finalWinnerScore = playerScores.get(winner)!.baseScore;

      // ✨ --- '고' 보너스 및 흔들기/폭탄 배수 적용 로직 --- ✨
      if (winner.goCount > 0) {
        if (winner.goCount <= 2) {
          finalWinnerScore += winner.goCount;
          this.roundEvents.push({ type: 'go_bonus_add', count: winner.goCount });
        } else {
          const multiplier = Math.pow(2, winner.goCount - 1); // 3고부터 2배, 4고는 4배
          finalWinnerScore *= multiplier;
          this.roundEvents.push({ type: 'go_bonus_multiply', count: winner.goCount, multiplier });
        }
      }

      let shakeBombMultiplier = 1;
      if (winner.shakingCount > 0) {
        shakeBombMultiplier *= Math.pow(2, winner.shakingCount);
      }
      if (winner.bombCount > 0) {
        shakeBombMultiplier *= Math.pow(2, winner.bombCount);
      }
      if (shakeBombMultiplier > 1) {
        finalWinnerScore *= shakeBombMultiplier;
        this.roundEvents.push({ type: 'shake_bomb_bonus', multiplier: shakeBombMultiplier });
      }
      
      finalWinnerScore *= this.drawMultiplier; // 나가리 배수 적용

      const winnerScoreDetails = playerScores.get(winner)!;
      const yeokGoPlayer = this.lastGoPlayerId && winner.id !== this.lastGoPlayerId
          ? this.players.find((p) => p.id === this.lastGoPlayerId)
          : null;

      // ✨ --- '역고' 로직 --- ✨
      if (yeokGoPlayer) {
        this.roundEvents.push({ type: 'yeokgo', winnerId: winner.id, loserId: yeokGoPlayer.id });
        
        // 역고박 적용: 다른 패배자들의 점수까지 모두 역고 플레이어가 책임짐
        let totalPayment = 0;
        this.activePlayers.filter((p) => p !== winner && p !== yeokGoPlayer).forEach(otherLoser => {
            // 다른 패배자들은 돈을 잃지 않음
            totalPayment += finalWinnerScore;
        });
        totalPayment += finalWinnerScore; // 역고 플레이어 본인의 점수

        yeokGoPlayer.budget -= totalPayment;
        winner.budget += totalPayment;

      } else {
        // ✨ --- 일반 승리 로직 (피박, 광박 등) --- ✨
        this.activePlayers.filter((p) => p !== winner).forEach((otherPlayer) => {
            const otherPlayerScoreDetails = playerScores.get(otherPlayer)!;
            let individualBakMultiplier = 1;
            const bakReasons: string[] = [];
            
            // '고'를 한 사람이 있다면, 그 사람은 점수를 2배로 잃음 (고박)
            const goBakMultiplier = this.lastGoPlayerId === otherPlayer.id ? 2 : 1;

            if (winnerScoreDetails.yulCount >= 7 && otherPlayerScoreDetails.yulCount === 0) {
              individualBakMultiplier *= 2; bakReasons.push(`멍박`);
            }
            if (winnerScoreDetails.piCount >= 10 && otherPlayerScoreDetails.piCount <= 5) {
              individualBakMultiplier *= 2; bakReasons.push(`피박`);
            }
            if (winnerScoreDetails.gwangCount >= 3 && otherPlayerScoreDetails.gwangCount === 0) {
              individualBakMultiplier *= 2; bakReasons.push(`광박`);
            }
            if (winnerScoreDetails.ttiCount >= 5 && otherPlayerScoreDetails.ttiCount === 0) {
              individualBakMultiplier *= 2; bakReasons.push(`띠박`);
            }

            if (bakReasons.length > 0) {
              this.roundEvents.push({ type: 'bak', targetId: otherPlayer.id, reasons: bakReasons });
            }
            if (goBakMultiplier > 1) {
              this.roundEvents.push({ type: 'gobak', targetId: otherPlayer.id });
            }

            const amountToPay = finalWinnerScore * individualBakMultiplier * goBakMultiplier;
            otherPlayer.budget -= amountToPay;
            winner.budget += amountToPay;
          });
      }
      this.drawMultiplier = 1; // 승패가 결정되었으므로 나가리 배수 초기화
    }

    const payouts = this.players.map((p) => ({
      playerId: p.id,
      amount: p.budget - initialBudgets[p.id],
    }));

    return { winnerId: winner?.id ?? null, payouts, isDraw };
  }

  // --- Helper Methods ---
  private findPlayer(playerId: string): Player {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) throw new Error(`Player with id ${playerId} not found.`);
    return player;
  }

  private collectCards(player: Player, cards: Card[]): void {
    if (cards.some((c) => c.isPpuk)) {
      this.roundEvents.push({
        type: "eat_ppuk",
        playerId: player.id,
        username: player.name,
      });
      this.takePiFromOthers(player, 1);
    }
    cards.forEach((c) => (c.isPpuk = false)); // 뻑 딱지 제거
    player.collectedCards.push(...cards);
  }

  private takePiFromOthers(player: Player, piValue: number): void {
    this.activePlayers.forEach((p) => {
      if (p.id !== player.id) this.transferPiCards(p, player, piValue);
    });
  }

  private transferPiCards(
    from: Player,
    to: Player,
    piValueToTransfer: number,
  ): void {
    let transferredPiValue = 0;
    const cardsToMove: Card[] = [];
    // Make copies to safely modify during iteration
    const currentSinglePi = [
      ...from.collectedCards.filter((c) => c.type === "pi"),
    ];

    // Try to take single pi first
    while (
      transferredPiValue < piValueToTransfer &&
      currentSinglePi.length > 0
    ) {
      const card = currentSinglePi.pop()!;
      cardsToMove.push(card);
      transferredPiValue += 1;
    }
  }

  private processBonusCardsRecursive(
    player: Player,
    card: Card,
  ): Card | undefined {
    let currentCard: Card | undefined = card;
    while (currentCard && currentCard.type === "bonus") {
      this.roundEvents.push({
        type: "bonus",
        playerId: player.id,
        cardName: currentCard.name,
      });
      this.collectCards(player, [currentCard]);
      this.takePiFromOthers(player, 1);
      currentCard = this.deck.pop();
    }
    return currentCard;
  }

  private getPiCountForMatch(
    playedCard: Card,
    flippedCard: Card | null,
    matches: Card[],
  ): number {
    let bonusCardCount = 0;
    if (playedCard.type === "bonus") bonusCardCount++;
    if (flippedCard && flippedCard.type === "bonus") bonusCardCount++;
    matches.forEach((c) => {
      if (c.type === "bonus") bonusCardCount++;
    });
    if (bonusCardCount >= 2) return 3;
    if (bonusCardCount === 1) return 2;
    return 1;
  }

  private checkGoStopCondition(player: Player): void {
    // 국진을 쌍피로 쓸지 먼저 물어봐야 하는 상황이면, 고/스톱을 묻지 않음
    if (this.checkAndPromptGukjinChoice(player)) {
      return;
    }

    const { baseScore } = this.calculateScore(player);

    // 점수가 3점 이상이고, 이전에 '고'를 외쳤을 때보다 점수가 높을 때만
    if (baseScore >= 3 && baseScore > player.lastGoScore) {
      player.lastGoScore = baseScore; // '고'를 할 수 있는 점수 기록
      
      // 'go_stop_prompt' 이벤트를 기록하여 서버에 알림
      this.roundEvents.push({
        type: 'go_stop_prompt',
        playerId: player.id,
        score: baseScore,
      });
    }
  }

  public handleGwangPalgi(player: Player): void {
    console.log(
      `handleGwangPalgi called for ${player.name}. Player hand:`,
      player.hand.map((c) => c.name),
    );
    const sellableCards = player.hand.filter(
      (card) =>
        card.type === "gwang" ||
        card.type === "ssangpi" ||
        card.type === "bonus" ||
        (card.type === "yul" && (card.month === 5 || card.month === 9)),
    );
    console.log(
      `Sellable cards for ${player.name}:`,
      sellableCards.map((c) => c.name),
    );
    const totalPointsFromSelling = sellableCards.length;
    if (totalPointsFromSelling > 0) {
      const soldCardNames = sellableCards.map((c) => c.name);
      const payers = this.activePlayers.filter((p) => p.id !== this.dealer.id);
      console.log(
        `  -> ${player.name}님이 다음 카드를 팝니다: ${soldCardNames.join(", ")}`,
      );
      console.log(
        `  -> '선'을 제외한 참가자(${payers.map((p) => p.name).join(", ")})에게서 총 ${totalPointsFromSelling}점씩 받습니다.`,
      );
      let totalPointsReceived = 0;
      for (const payer of payers) {
        payer.budget -= totalPointsFromSelling;
        totalPointsReceived += totalPointsFromSelling;
      }
      player.budget += totalPointsReceived;
      player.hand = player.hand.filter((c) => !sellableCards.includes(c));
    } else {
      console.log(`  -> ${player.name}님은 팔 카드가 없습니다.`);
    }
  }

  private resolveChoice(
    player: Player,
    chosenCardName: string,
  ): { needsFlip: boolean; originalFlippedCard: Card | null } {
    const choice = this.pendingChoice!;
    const chosenCard = choice.options.find((c) => c.name === chosenCardName)!;
    const unchosenCard = choice.options.find((c) => c.name !== chosenCardName)!; // The card not chosen

    console.log(`${player.name}님이 ${chosenCard.name}을(를) 선택했습니다.`);

    this.floorCards = this.floorCards.filter(
      (c) => c.id !== chosenCard.id && c.id !== unchosenCard.id,
    );
    this.collectCards(player, [choice.playedCard, chosenCard]);
    this.floorCards.push(unchosenCard);
    this.pendingChoice = null;

    const needsFlip = choice.playedCard.id !== choice.flippedCard.id; // True if playedCard is from hand, and flippedCard is from deck
    return {
      needsFlip,
      originalFlippedCard: needsFlip ? choice.flippedCard : null,
    };
  }

  private playBonusCardFromHand(player: Player, card: Card) {
    player.hand.splice(player.hand.indexOf(card), 1);
    this.collectCards(player, [card]);
    this.takePiFromOthers(player, 1);
    const newCard = this.deck.pop();
    if (newCard) {
      console.log(
        `[playBonusCardFromHand] Deck size before add: ${this.deck.length}`,
      );
      player.hand.push(newCard);
      console.log(
        `[playBonusCardFromHand] Deck size after add: ${this.deck.length}`,
      );
    }
  }

  private handleFloorBonusCards() {
    let bonusOnFloor = this.floorCards.filter((c) => c.type === "bonus");
    while (bonusOnFloor.length > 0) {
      const bonusCard = bonusOnFloor.shift()!;
      console.log(`바닥 보너스: ${bonusCard.name} -> 선(${this.dealer.name})`);
      this.floorCards = this.floorCards.filter((c) => c !== bonusCard);
      this.collectCards(this.dealer, [bonusCard]);
      const newCard = this.deck.pop();
      if (newCard) {
        this.floorCards.push(newCard);
        bonusOnFloor = this.floorCards.filter((c) => c.type === "bonus");
      } else {
        bonusOnFloor = [];
      }
    }
  }
  private checkAndPromptGukjinChoice(player: Player): boolean {
    if (player.gukjinChoiceMade) return false;
    
    const hasGukjin = player.collectedCards.some(c => c.name === '9월 십 (국진)');
    if (!hasGukjin) return false;

    const { piCount } = this.calculateScore(player);

    if (piCount >= 10) {
      this.gukjinChoicePendingForPlayerId = player.id;
      player.gukjinChoiceMade = true;
      this.roundEvents.push({ type: 'gukjin_choice_prompt', playerId: player.id });
      return true;
    }
    return false;
  }
}
