export type TrashTalkPersonality = 'confident' | 'cocky' | 'friendly' | 'sarcastic' | 'silent';

export type GameEvent =
  | 'game_start'
  | 'ai_capture'
  | 'player_capture'
  | 'ai_multi_capture'
  | 'player_multi_capture'
  | 'ai_king'
  | 'player_king'
  | 'ai_winning'
  | 'player_winning'
  | 'ai_won'
  | 'player_won';

export async function generateTrashTalk(
  personality: TrashTalkPersonality,
  event: GameEvent,
  context: {
    playerScore: number;
    aiScore: number;
    moveCount: number;
    wasMultiCapture?: boolean;
  }
): Promise<string> {
  if (personality === 'silent' && !['ai_won', 'player_won', 'ai_multi_capture'].includes(event)) {
    return '';
  }

  return getDefaultTrashTalk(event);
}

function getDefaultTrashTalk(event: GameEvent): string {
  const defaults: Record<GameEvent, string> = {
    game_start: "Let's see what you've got!",
    ai_capture: "Nice piece!",
    player_capture: "Good move.",
    ai_multi_capture: "Double trouble!",
    player_multi_capture: "Impressive combo!",
    ai_king: "Crowned and dangerous!",
    player_king: "You earned that crown.",
    ai_winning: "I'm pulling ahead!",
    player_winning: "You're playing well.",
    ai_won: "Good game!",
    player_won: "Well played, you got me!"
  };
  return defaults[event];
}
