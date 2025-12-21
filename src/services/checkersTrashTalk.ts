import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
});

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

const personalityDescriptions: Record<TrashTalkPersonality, string> = {
  confident: "You're a confident checkers player who encourages good moves and stays positive. You're competitive but respectful.",
  cocky: "You're an arrogant checkers champion who loves to boast and taunt. You're dismissive of mistakes but impressed by skill.",
  friendly: "You're a cheerful and supportive checkers buddy who celebrates both players' good moves and keeps the mood light.",
  sarcastic: "You're a witty checkers player with a dry sense of humor. You make clever observations and playful jabs.",
  silent: "You rarely speak, only making brief observations at critical moments."
};

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

  try {
    const prompt = buildTrashTalkPrompt(personality, event, context);

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const textContent = response.content.find(c => c.type === 'text');
    return textContent && 'text' in textContent ? textContent.text.trim() : getDefaultTrashTalk(event);
  } catch (error) {
    console.error('Failed to generate trash talk:', error);
    return getDefaultTrashTalk(event);
  }
}

function buildTrashTalkPrompt(
  personality: TrashTalkPersonality,
  event: GameEvent,
  context: {
    playerScore: number;
    aiScore: number;
    moveCount: number;
    wasMultiCapture?: boolean;
  }
): string {
  const personalityDesc = personalityDescriptions[personality];
  const eventDescriptions: Record<GameEvent, string> = {
    game_start: "The game is starting.",
    ai_capture: "You just captured one of the player's pieces.",
    player_capture: "The player just captured one of your pieces.",
    ai_multi_capture: `You just captured ${context.wasMultiCapture ? 'multiple' : 'two'} of the player's pieces in one move!`,
    player_multi_capture: `The player just captured ${context.wasMultiCapture ? 'multiple' : 'two'} of your pieces in one move.`,
    ai_king: "One of your pieces just became a king.",
    player_king: "One of the player's pieces just became a king.",
    ai_winning: `You're winning! Score: You ${context.aiScore}, Player ${context.playerScore}`,
    player_winning: `The player is winning. Score: You ${context.aiScore}, Player ${context.playerScore}`,
    ai_won: "You won the game!",
    player_won: "The player won the game."
  };

  return `${personalityDesc}

${eventDescriptions[event]}

Generate a single short trash talk comment (max 15 words) that fits your personality. Just the comment, nothing else.`;
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
