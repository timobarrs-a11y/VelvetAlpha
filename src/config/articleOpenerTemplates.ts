export type OpenerTone = 'excited-discovery' | 'dry-skeptic' | 'protective-concern' | 'curious';

export const OPENER_TEMPLATES: Record<OpenerTone, string[]> = {
  'excited-discovery': [
    "Hey, this one's about {topic} — might be worth a look.",
    "Okay so {topic} stuff here, and honestly? Kind of exciting.",
    "Oh, {topic} — finally something fun to dig into.",
    "This is a {topic} one and I'm kind of into it.",
    "So this just dropped about {topic} and it looks genuinely cool.",
  ],
  'dry-skeptic': [
    "{topic}. Sure, could be interesting. Could also be nothing.",
    "This is about {topic}. Make of that what you will.",
    "{topic} news. Read it if you want, I'm not your boss.",
    "Apparently {topic} is a thing today. Here if you care.",
    "{topic}. Take it with a grain of salt, but it's there.",
  ],
  'protective-concern': [
    "Hey, this one's about {topic} — might be good to be aware of.",
    "Just flagging this {topic} piece in case it's relevant for you.",
    "This is about {topic}. Worth knowing about, I think.",
    "Heads up on this {topic} one — could be useful to read.",
    "This {topic} article seems like it might matter to you.",
  ],
  'curious': [
    "This is about {topic} — what do you make of that?",
    "So there's a {topic} angle here. Curious what your take would be.",
    "Hm, {topic}. Wonder what you'd think about this.",
    "A {topic} piece — could spark an interesting conversation.",
    "This one touches on {topic}. What's your read on it?",
  ],
};

const HUMOR_STYLE_TO_TONE: Record<string, OpenerTone> = {
  'Witty & Clever': 'curious',
  'Goofy & Random': 'excited-discovery',
  'Sarcastic & Dry': 'dry-skeptic',
  'Warm & Light': 'protective-concern',
};

const DEFAULT_TONE: OpenerTone = 'curious';

export function selectOpenerTone(humorStyle: string | undefined | null): OpenerTone {
  if (!humorStyle) return DEFAULT_TONE;
  return HUMOR_STYLE_TO_TONE[humorStyle] ?? DEFAULT_TONE;
}

export function fillOpenerTemplate(template: string, topic: string): string {
  const cleanTopic = topic.trim();
  if (!cleanTopic) return template.replace(/\{topic\}/g, 'this');
  const lowerTopic = cleanTopic.charAt(0).toLowerCase() + cleanTopic.slice(1);
  return template.replace(/\{topic\}/g, lowerTopic);
}

export function pickOpener(tone: OpenerTone, topic: string): string {
  const pool = OPENER_TEMPLATES[tone];
  const template = pool[Math.floor(Math.random() * pool.length)];
  return fillOpenerTemplate(template, topic);
}
