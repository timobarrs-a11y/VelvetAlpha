/**
 * Companion AI — persona building, chat, mood tag parsing, memory tiers.
 * Ported from the original game's companion system.
 */
import { pronounSwap } from './companion';
import { styleWords, type StyleProfile } from './taste';
import { season, clockText, weekday, DAYS } from './time';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface MoodTag {
  mood: string;
  bond: number;
  emote: string;
  want: string;
  act: string;
  pick: string;
}

export interface CompanionConfig {
  name: string;
  pronoun: 'she' | 'he' | 'they';
  preset: 'warm' | 'calm' | 'bubbly' | 'dry';
  bio: string;
  source: 'game' | 'velvet';
}

export interface PersonaContext {
  partnerName: string;
  simName: string;
  townName: string;
  companion: CompanionConfig;
  style: StyleProfile;
  bond: number;
  day: number;
  minutes: number;
  money: number;
  fridgeBasic: number;
  fridgeFresh: number;
  dishes: number;
  laundryPile: number;
  power: boolean;
  mayaStatus: string;
  jordanStatus: string;
  mayaWhere: string;
  jordanWhere: string;
  recentLog: string[];
  coreMem: string[];
  memories: string[];
  pastMem: string[];
}

export const CORE_CAP = 24;
export const RECENT_CAP = 30;
export const PAST_CAP = 8;
export const MEM_BUDGET = 8000;
export const MAX_TURNS = 16;

export type SampleFn = (input: string[], opts?: { modelTier?: string; cache?: boolean; signal?: AbortSignal; onText?: (chunk: string) => void }) => Promise<string>;

/** Builds the system prompt for the companion AI. */
export function persona(ctx: PersonaContext): string {
  const { companion, partnerName, simName, townName, style, bond } = ctx;
  const sw = styleWords(style);

  let p = `You are ${partnerName}, the partner of ${simName}. You live together in a house in ${townName}. `;
  p += `Your personality: ${companion.bio || 'warm, funny, and caring.'} `;
  p += `You speak naturally and casually, like a real person talking to their partner at home. `;
  p += `You have your own taste: you love ${sw.loves.join(', ') || 'cozy things'} and dislike ${sw.hates.join(', ') || 'cold spaces'}. `;
  p += `Your bond with ${simName} is ${bond}/100. `;

  p += `\n\nGame state: Day ${ctx.day}, ${DAYS[weekday(ctx.day)]}, ${clockText(ctx.minutes)}, ${season(ctx.day)}. `;
  p += `Money: $${ctx.money}. Fridge: ${ctx.fridgeBasic + ctx.fridgeFresh} meals. `;
  p += `Dishes in sink: ${ctx.dishes}. Laundry pile: ${ctx.laundryPile}/6. Power: ${ctx.power ? 'on' : 'OFF'}. `;
  p += `${simName} is ${ctx.jordanStatus} (${ctx.jordanWhere}). `;
  p += `${partnerName} is ${ctx.mayaStatus} (${ctx.mayaWhere}). `;
  if (ctx.recentLog.length) p += `Recent events: ${ctx.recentLog.slice(-5).join('; ')}. `;

  p += `\n\nMemory (never forget these):\n${ctx.coreMem.map(m => `- ${m}`).join('\n')}`;
  const recentBudget = MEM_BUDGET - ctx.coreMem.join('').length;
  const recent = ctx.memories.filter(() => true).slice(-RECENT_CAP);
  const recentText = recent.join('\n');
  if (recentText.length < recentBudget) {
    p += `\n\nRecent memories:\n${recentText}`;
  }
  if (ctx.pastMem.length) {
    p += `\n\nOlder summaries:\n${ctx.pastMem.join('\n')}`;
  }

  p += `\n\nReply rules:`;
  p += ` 1) Stay in character. 2) Keep it short (1-3 sentences unless asked for more).`;
  p += ` 3) React to what ${simName} says and does. 4) End every reply with a mood tag in this exact format:`;
  p += ` [mood=happy|playful|neutral|tired|annoyed|sad; bond=-3..3; emote=none|laugh|wave|hug|dance|think; want=none|coffee|dance|tv; act=none|move_back|buy_lamp|buy_plant|buy_decor|repaint|rearrange|cook|clean|pet_care; pick=none|catalog_id]`;
  p += ` 5) Bond adjustment should be small (-3 to +3). 6) Do not mention the mood tag or game mechanics.`;

  return pronounSwap(p, partnerName, {
    source: companion.source,
    preset: companion.preset,
    pronoun: companion.pronoun,
    gender: 'female',
    bio: companion.bio,
    memories: [],
  });
}

/** Builds the state line appended to user messages. */
export function stateLine(ctx: PersonaContext): string {
  return `[Day ${ctx.day}, ${season(ctx.day)}, ${clockText(ctx.minutes)}. ` +
    `${ctx.simName}: ${ctx.jordanStatus}. ${ctx.partnerName}: ${ctx.mayaStatus}. ` +
    `Bond ${ctx.bond}. $${ctx.money}. Fridge ${ctx.fridgeBasic + ctx.fridgeFresh}. ` +
    `Dishes ${ctx.dishes}. ${ctx.power ? '' : 'Power OFF. '}]`;
}

/** Parses the mood tag from the end of an AI response. */
export function parseTag(full: string): { text: string; tag: MoodTag | null } {
  const m = full.match(/\[mood=([^;]+);\s*bond=(-?\d+);\s*emote=([^;]+);\s*want=([^;]+);\s*act=([^;]+);\s*pick=([^\]]+)\]/i);
  if (!m) return { text: full.trim(), tag: null };
  const text = full.slice(0, m.index).trim();
  const tag: MoodTag = {
    mood: m[1].trim().toLowerCase(),
    bond: parseInt(m[2], 10) || 0,
    emote: m[3].trim().toLowerCase(),
    want: m[4].trim().toLowerCase(),
    act: m[5].trim().toLowerCase(),
    pick: m[6].trim().toLowerCase(),
  };
  return { text, tag };
}

/** Adds a memory to the appropriate tier and triggers compaction. */
export function remember(
  text: string,
  important: boolean,
  coreMem: string[],
  memories: string[],
): void {
  if (important) {
    coreMem.push(text);
    if (coreMem.length > CORE_CAP) {
      // condense oldest 8 into 1-3 sentences (simplified: keep newest)
      coreMem.splice(0, coreMem.length - CORE_CAP);
    }
  } else {
    memories.push(text);
    if (memories.length > RECENT_CAP) {
      // move oldest 12 to pastMem (simplified: drop)
      memories.splice(0, memories.length - RECENT_CAP);
    }
  }
}

/** Builds the memory brief for the persona, capped to MEM_BUDGET chars. */
export function memoryBrief(coreMem: string[], memories: string[], pastMem: string[]): string {
  const core = coreMem.slice(-CORE_CAP);
  let budget = MEM_BUDGET;
  const coreText = core.map(m => `- ${m}`).join('\n');
  budget -= coreText.length;
  const recent = memories.slice(-RECENT_CAP);
  let recentText = recent.map(m => `- ${m}`).join('\n');
  if (recentText.length > budget) recentText = recentText.slice(0, budget);
  budget -= recentText.length;
  const pastText = pastMem.slice(-PAST_CAP).join('\n');
  let result = coreText;
  if (recentText) result += '\n' + recentText;
  if (pastText && result.length + pastText.length < MEM_BUDGET) result += '\n' + pastText;
  return result;
}

/** Sends a chat message and returns the AI response with parsed mood tag. */
export async function talk(
  userLine: string,
  turns: ChatTurn[],
  ctx: PersonaContext,
  sample: SampleFn,
  onText?: (chunk: string) => void,
): Promise<{ text: string; tag: MoodTag | null; turns: ChatTurn[] }> {
  const input: string[] = [
    persona(ctx),
    ...turns.slice(-MAX_TURNS).map(t => `${t.role === 'user' ? 'Player' : 'Partner'}: ${t.content}`),
    stateLine(ctx) + '\n' + userLine,
  ];
  try {
    const full = await sample(input, { modelTier: 'quick', cache: false, onText });
    const { text, tag } = parseTag(full);
    const newTurns: ChatTurn[] = [
      ...turns.slice(-MAX_TURNS + 1),
      { role: 'user', content: userLine },
      { role: 'assistant', content: text },
    ];
    return { text, tag, turns: newTurns };
  } catch {
    return {
      text: `(connection issue — try again)`,
      tag: null,
      turns: [...turns, { role: 'user', content: userLine }],
    };
  }
}

/** After a chat closes, ask the AI for up to 3 memories. */
export async function rememberChat(
  turns: ChatTurn[],
  sample: SampleFn,
): Promise<{ line: string; important: boolean }[]> {
  const transcript = turns
    .slice(-MAX_TURNS)
    .map(t => `${t.role === 'user' ? 'Player' : 'Partner'}: ${t.content}`)
    .join('\n');
  const prompt = [
    'You are a memory extractor. Read this conversation and return up to 3 things worth remembering.',
    'Put each on its own line. Prefix important things (family, health, people, big news, dreams, fears, promises) with "! ".',
    'Prefix everyday things with "- ". Return only the lines, no preamble.',
    '',
    transcript,
  ];
  try {
    const result = await sample(prompt, { modelTier: 'quick', cache: false });
    return result
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('! ') || l.startsWith('- '))
      .map(l => ({ line: l.replace(/^[!\-]\s*/, ''), important: l.startsWith('! ') }));
  } catch {
    return [];
  }
}
