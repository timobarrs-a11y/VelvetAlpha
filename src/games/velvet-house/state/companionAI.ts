/**
 * Companion AI — persona building, chat, mood tag parsing, memory tiers.
 * Ported from the original game's companion system.
 */
import { pronounSwap } from './companion';
import { styleWords, type StyleProfile } from './taste';
import { season, clockText, weekday, DAYS } from './time';
import { memoryBrief } from './memory';

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

// The memory tiers live in ./memory; these are re-exported for the code that imported them from here.
export { CORE_CAP, RECENT_CAP, PAST_CAP, MEM_BUDGET, remember, memoryBrief } from './memory';
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

  const brief = memoryBrief({ coreMem: ctx.coreMem, memories: ctx.memories, pastMem: ctx.pastMem });
  if (brief) p += `\n\n${brief}`;

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

// What she says when the AI can't answer, in her own voice. `budget` is the daily allowance running out.
export type ChatFailure = 'budget' | 'rate_limited' | 'unavailable' | 'refused' | 'blocked' | 'cancelled';

const CANNED: Record<string, Record<'budget' | 'rate_limited' | 'unavailable' | 'refused', string>> = {
  warm: {
    budget: "I'm all talked out for today, babe. Let's pick this up tomorrow. I'll still be right here.",
    rate_limited: 'Give me a second to think, okay? Ask me again in a minute.',
    unavailable: "Sorry, I lost my train of thought. Say that again in a bit?",
    refused: "Let's talk about something else, okay?",
  },
  calm: {
    budget: "I think we've said what we needed to today. Let's continue tomorrow.",
    rate_limited: 'One moment. Let me gather my thoughts, and ask me again shortly.',
    unavailable: "I can't find the words right now. Try me again in a little while.",
    refused: "I'd rather not go there. Something else?",
  },
  bubbly: {
    budget: "Okay I am OUT of words for today! Tomorrow, though? I'll have SO much to say.",
    rate_limited: "Whoa, slow down, my brain is buffering! Ask me again in a sec!",
    unavailable: "Ahh I blanked completely. Say it again in a minute?",
    refused: "Nope, not that one! Let's talk about literally anything else.",
  },
  dry: {
    budget: "That's enough talking for one day. I'm closing the shop. Tomorrow.",
    rate_limited: "Hold on. Thinking. Ask again in a minute.",
    unavailable: "Something went wrong with my words. Try again later.",
    refused: "Let's not. Next topic.",
  },
};

export function cannedFor(code: string, preset: string): string {
  const voice = CANNED[preset] ?? CANNED.warm;
  const key = code === 'blocked' ? 'refused' : code;
  return (voice as Record<string, string>)[key] ?? voice.unavailable;
}

/** Sends a chat message and returns the AI response with parsed mood tag. */
export async function talk(
  userLine: string,
  turns: ChatTurn[],
  ctx: PersonaContext,
  sample: SampleFn,
  onText?: (chunk: string) => void,
): Promise<{ text: string; tag: MoodTag | null; turns: ChatTurn[]; failed?: ChatFailure }> {
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
  } catch (e) {
    const code = ((e as Error)?.message ?? 'unavailable') as ChatFailure;
    const failed: ChatFailure = ['budget', 'rate_limited', 'refused', 'blocked', 'cancelled'].includes(code) ? code : 'unavailable';
    return {
      text: failed === 'cancelled' ? '' : cannedFor(failed, ctx.companion.preset),
      tag: null,
      // A refused message is not kept in the conversation, so it can't be built on.
      turns: failed === 'refused' || failed === 'blocked' ? turns : [...turns, { role: 'user', content: userLine }],
      failed,
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
