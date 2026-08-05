export type CommentaryEvent =
  | 'player_good_move'
  | 'player_combo'
  | 'player_king'
  | 'player_capture'
  | 'player_risky_move'
  | 'ai_combo'
  | 'ai_capture'
  | 'ai_king'
  | 'ai_good_move'
  | 'game_start'
  | 'player_win'
  | 'ai_win'
  | 'close_game'
  | 'player_mistake';

interface CommentarySet {
  [key: string]: string[];
}

const COMMENTARY: CommentarySet = {
  player_good_move: [
    "ooh nice move!",
    "okay I see you 👀",
    "that was smart actually",
    "not bad at all!",
    "wait that was good lol",
  ],
  player_combo: [
    "damn! nice combo move 😳",
    "okay okay that was sick!",
    "wait how did you do that?? 🤯",
    "yooo that combo though!",
    "alright that was actually impressive",
  ],
  player_king: [
    "oh you got a king now? okay I see you 👑",
    "king huh? don't get too confident 😏",
    "nice! you earned that crown",
    "oooh a king! this just got interesting",
  ],
  player_capture: [
    "ow! okay you got me there",
    "hey! 😤",
    "not bad...",
    "oh come on!",
    "alright alright you got that one",
  ],
  player_risky_move: [
    "umm... you sure about that move? 👀",
    "interesting choice...",
    "bold move, let's see how that works out",
    "wait are you setting me up? 🤔",
  ],
  ai_combo: [
    "haha got you with that combo! 😎",
    "yesss! did you see that? 💪",
    "boom! combo move baby",
    "sorry not sorry 😏",
    "that's how it's done!",
  ],
  ai_capture: [
    "gotcha! 😏",
    "mine now 😊",
    "got you!",
    "yoink! 😂",
    "hehe",
  ],
  ai_king: [
    "king me! 👑",
    "ooh I got a king now! watch out",
    "that's a crown for me 😌",
  ],
  ai_good_move: [
    "pretty good move if I say so myself",
    "I'm kinda cooking right now ngl",
    "see? I'm learning your style",
  ],
  game_start: [
    "hey! ready to play some checkers? let's see what you got 😏",
    "alright let's do this! fair warning, I've been practicing 😊",
    "checkers time! prepare to lose... kidding! ...maybe 😂",
    "ready? don't go easy on me!",
  ],
  player_win: [
    "wow you actually beat me! good game 😊",
    "okay okay you got me! rematch? 🥺",
    "gg! you're better than I thought 😅",
    "dang you're good! I want a rematch tho",
    "fine you win this time! but I'll get you next game 😤",
  ],
  ai_win: [
    "haha I win! wanna try again? 😏",
    "gg! you made me work for that one",
    "that was fun! another round?",
    "I win but you played well! again? 😊",
    "got you! but you're getting better, I can tell",
  ],
  close_game: [
    "this is close! 😬",
    "okay this is getting intense...",
    "my heart is racing lol",
    "this could go either way!",
  ],
  player_mistake: [
    "oh no... did you mean to do that?",
    "wait... that wasn't a trap was it? 👀",
    "hmm... interesting move",
  ],
};

export class CheckersCommentaryService {
  private static usedComments: Map<string, Set<number>> = new Map();

  static getComment(event: CommentaryEvent, _moveCount?: number): string {
    const comments = COMMENTARY[event];
    if (!comments || comments.length === 0) {
      return '';
    }

    if (!this.usedComments.has(event)) {
      this.usedComments.set(event, new Set());
    }

    const used = this.usedComments.get(event)!;

    const availableIndices = comments
      .map((_, index) => index)
      .filter(index => !used.has(index));

    if (availableIndices.length === 0) {
      used.clear();
      availableIndices.push(...comments.map((_, index) => index));
    }

    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    used.add(randomIndex);

    return comments[randomIndex];
  }

  static shouldCommentOnMove(moveCount: number): boolean {
    if (moveCount <= 3) return true;

    if (moveCount % 5 === 0) return true;

    return Math.random() < 0.3;
  }

  static analyzePlayerMove(
    captureCount: number,
    becameKing: boolean,
    pieceDifference: number
  ): CommentaryEvent | null {
    if (captureCount > 1) return 'player_combo';
    if (becameKing) return 'player_king';
    if (captureCount === 1) return 'player_capture';

    if (pieceDifference < -3) {
      return Math.random() < 0.3 ? 'player_good_move' : null;
    }

    return Math.random() < 0.2 ? 'player_good_move' : null;
  }

  static analyzeAIMove(
    captureCount: number,
    becameKing: boolean,
    moveCount: number
  ): CommentaryEvent | null {
    if (captureCount > 1) return 'ai_combo';
    if (becameKing) return 'ai_king';
    if (captureCount === 1) return 'ai_capture';

    if (moveCount > 10 && Math.random() < 0.15) {
      return 'ai_good_move';
    }

    return null;
  }

  static getGameEndComment(playerWon: boolean, _movesPlayed: number): string {
    const event: CommentaryEvent = playerWon ? 'player_win' : 'ai_win';
    return this.getComment(event);
  }

  static clearUsedComments(): void {
    this.usedComments.clear();
  }
}
