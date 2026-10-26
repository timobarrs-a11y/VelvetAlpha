// The game builds its AI prompts as lines of text: the persona first, then
// "Player: ..." / "Partner: ..." turns, then the newest message. The backend
// (`velvet-game-turn`) wants chat messages, with the persona as a first "user"
// message. This turns one into the other, so the host page can pass it on.

export interface GameTurnMessage {
  role: 'user' | 'assistant';
  content: string;
}

const HELPER_PREAMBLE = 'You are a background helper for the game. Do exactly the task you are given next and return only what it asks for.';

export function toGameTurnInput(lines: string[]): GameTurnMessage[] {
  const clean = lines.map(l => String(l ?? '')).filter(l => l.trim());
  if (clean.length === 0) return [];
  // A lone prompt (such as the memory extractor) has no chat around it.
  if (clean.length === 1) return [{ role: 'user', content: HELPER_PREAMBLE }, { role: 'user', content: clean[0] }];
  const [persona, ...rest] = clean;
  const msgs: GameTurnMessage[] = [{ role: 'user', content: persona }];
  rest.forEach((line, i) => {
    const last = i === rest.length - 1;
    if (line.startsWith('Partner: ') && !last) msgs.push({ role: 'assistant', content: line.slice('Partner: '.length) });
    else msgs.push({ role: 'user', content: line.startsWith('Player: ') ? line.slice('Player: '.length) : line });
  });
  return msgs;
}
