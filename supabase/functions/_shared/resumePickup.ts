/**
 * Picking up where someone left off (supabase/functions/resume-pickup). Pure helpers, so the rules are in one place:
 * what counts as their own words, what a pickup may never say, and when a new pickup is too close to an old one.
 */

export type ResumeStage = 'no_goal' | 'goal_no_plan' | 'plan_unaccepted' | 'commitments_due';

/** Someone away this long is first asked whether the goal still fits. */
export const AWAY_ASK_DAYS = 14;
/** How many past pickups a new one is checked against. */
export const PICKUP_MEMORY = 10;

/**
 * Their own words: the first two or three sentences they wrote about their goals and dreams, word for word, from
 * their first messages in order. Nothing is reworded; a message with no sentence end counts as one sentence.
 */
export function firstSentences(texts: string[], max = 3): string {
  const out: string[] = [];
  for (const raw of texts) {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    for (const s of text.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) ?? [text]) {
      const t = s.trim();
      if (t) out.push(t);
      if (out.length >= max) return out.join(' ').slice(0, 1200);
    }
    // Two sentences already is enough to pick up from; a third message is usually a reply to a question.
    if (out.length >= 2) break;
  }
  return out.join(' ').slice(0, 1200);
}

/** Lines a pickup must never use: a restart, not a continuation. */
export const STOCK_LINES: RegExp[] = [
  /\bwelcome back\b/i,
  /\bgood to (see|have) you\b/i,
  /\bnice to see you\b/i,
  /\b(hey|hi|hello) (there|again)\b/i,
  /\blong time no see\b/i,
  /\bwhere were we\b/i,
  /\bhow can i help\b/i,
  /\bpicking up where we left off\b/i,
];

export function stockLineIn(text: string): string | null {
  const hit = STOCK_LINES.map((r) => text.match(r)).find(Boolean);
  return hit ? hit[0] : null;
}

const words = (s: string): string[] => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
const trigrams = (s: string): Set<string> => {
  const w = words(s);
  const out = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
};

/** How much two messages share, by runs of three words (0 to 1). A quote of their own words is left out of it. */
export function overlap(a: string, b: string, quote = ''): number {
  const q = trigrams(quote);
  const ta = [...trigrams(a)].filter((t) => !q.has(t)), tb = new Set([...trigrams(b)].filter((t) => !q.has(t)));
  if (!ta.length || !tb.size) return 0;
  const shared = ta.filter((t) => tb.has(t)).length;
  return shared / Math.min(ta.length, tb.size);
}

/** The old pickup a draft echoes too closely, if any. */
export function echoes(draft: string, past: string[], quote = '', limit = 0.35): string | null {
  return past.find((p) => p.trim() === draft.trim() || overlap(draft, p, quote) >= limit) ?? null;
}

export interface PickupContext {
  stage: ResumeStage;
  /** Who is speaking: Atlas, or the coach by name. */
  speaker: { kind: 'atlas' | 'coach'; name: string };
  address: string | null;
  goalTitle: string | null;
  ownWords: string | null;
  /** The last few messages of the conversation being continued, oldest first. */
  recent: Array<{ role: 'user' | 'assistant'; content: string }>;
  daysAway: number;
  coachName: string | null;
  pastPickups: string[];
}

const NEXT_STEP: Record<ResumeStage, (c: PickupContext) => string> = {
  no_goal: () => 'settle on the one goal to work toward: ask the single question that gets them there',
  goal_no_plan: (c) => `build the plan for the goal with ${c.coachName ?? 'their coach'}, who is ready to start from what they said`,
  plan_unaccepted: () => 'look over the plan in the Plan tab and say yes to it, or say what to change',
  commitments_due: () => 'set the next commitments: ask what they can do this week',
};

export function buildPickupPrompt(c: PickupContext): string {
  const who = c.speaker.kind === 'atlas'
    ? 'You are Atlas, their guide in the app, who helped them find their goal.'
    : `You are ${c.speaker.name}, their coach for the goal.`;
  const away = c.daysAway >= AWAY_ASK_DAYS
    ? `They have been away ${Math.round(c.daysAway)} days. Before anything else, ask plainly whether the goal still fits them, and say the next step only as what happens if it does.`
    : `They have been away ${c.daysAway < 1 ? 'a few hours' : `${Math.round(c.daysAway)} days`}.`;
  const lines = [
    who,
    'They are coming back to the app. Write the one message that picks the conversation up where it stopped.',
    '',
    'Rules:',
    '- Continue the last conversation as if it never paused. No greeting, no "welcome back", no "good to see you", no "where were we".',
    '- Quote one specific thing they said, word for word, in quotation marks: from their own words below if there are any, else from their last messages.',
    `- Name exactly one next step: ${c.stage === 'goal_no_plan' && c.speaker.kind === 'coach'
      ? 'build the plan together now: Atlas has passed them to you, so start from their words and ask the first thing you need to know'
      : NEXT_STEP[c.stage](c)}.`,
    `- ${away}`,
    '- Two to four short sentences, under 70 words. Plain words, no lists, no emoji, no bold.',
    c.address ? `- Call them ${c.address}, once at most.` : '- Do not use a name for them.',
    '',
    c.goalTitle ? `Their goal: "${c.goalTitle}".` : 'They have not settled on a goal yet.',
    c.ownWords ? `In their own words, when they started: "${c.ownWords}"` : 'Their own words were not saved.',
  ];
  if (c.pastPickups.length) {
    lines.push('', 'Messages already sent to them when they came back. Do not repeat or closely echo any of them, in wording or in shape:');
    for (const p of c.pastPickups) lines.push(`- ${p}`);
  }
  return lines.join('\n');
}

/** The conversation so far, as the model's input: the last messages, then the cue. */
export function pickupMessages(c: PickupContext): Array<{ role: 'user' | 'assistant'; content: string }> {
  const transcript = c.recent.length
    ? c.recent.map((m) => `${m.role === 'user' ? 'Them' : c.speaker.name}: ${m.content.replace(/\s+/g, ' ').slice(0, 600)}`).join('\n')
    : '(no messages yet)';
  return [{ role: 'user', content: `The conversation so far:\n${transcript}\n\nWrite the pickup message now. Only the message.` }];
}
