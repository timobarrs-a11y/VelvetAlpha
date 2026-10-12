import type { InsightCard } from './types';

interface ProfileData {
  name: string | null;
  nickname: string | null;
  favorite_color: string | null;
  zodiac_sign: string | null;
  birthday: string | null;
  gender: string | null;
  music_genre: string | null;
  hobbies: string[];
  sports: string[];
  sports_interests: string[];
  entertainment_interests: string[];
  tech_interests: string[];
  lifestyle_interests: string[];
  communication_profile: {
    conflict: string;
    connection: string;
    decisionStyle: string;
    motivation: string;
  } | null;
}

const COMMUNICATION_LABELS: Record<string, { label: string; description: string }> = {
  solutions: { label: 'Logical problem-solver', description: "You want to figure things out — when something's wrong, you reach for solutions before comfort." },
  empathy: { label: 'Emotionally attuned', description: 'You want to be heard before being fixed. Emotional understanding comes first for you.' },
  deep: { label: 'Deep conversationalist', description: 'You connect best through meaningful one-on-one conversations that go beneath the surface.' },
  lively: { label: 'Lively banterist', description: 'You connect through energetic back-and-forth — banter is your love language.' },
  intuitive: { label: 'Gut-led decision maker', description: "You trust your instincts — when a decision feels right, you move on it." },
  analytical: { label: 'Research-driven decision maker', description: 'You weigh every option before committing — research is your comfort zone.' },
  internal: { label: 'Self-driven', description: 'Your motivation comes from within — you do things because you want to, not because someone is watching.' },
  external: { label: 'Accountability-powered', description: 'You thrive when someone else is counting on you — external accountability lights your fire.' },
};

function commLabel(key: string, value: string): string | null {
  const entry = COMMUNICATION_LABELS[value];
  if (!entry) return null;
  return entry[key === 'conflict' ? 'label' : key === 'connection' ? 'label' : key === 'decisionStyle' ? 'label' : 'label'];
}

function commDesc(value: string): string | null {
  const entry = COMMUNICATION_LABELS[value];
  return entry?.description ?? null;
}

function joinList(items: string[], max: number = 3): string {
  const picked = items.slice(0, max);
  if (picked.length === 0) return '';
  if (picked.length === 1) return picked[0];
  if (picked.length === 2) return `${picked[0]} and ${picked[1]}`;
  return `${picked.slice(0, -1).join(', ')}, and ${picked[picked.length - 1]}`;
}

export function generateProfileInsights(profile: ProfileData): InsightCard[] {
  const cards: InsightCard[] = [];
  const name = profile.nickname || profile.name || 'You';

  // Card 1: Interests & hobbies map
  const allInterests = [
    ...(profile.hobbies || []),
    ...(profile.entertainment_interests || []),
    ...(profile.lifestyle_interests || []),
  ];
  if (allInterests.length > 0) {
    const top = joinList(allInterests, 4);
    cards.push({
      id: 'profile-interests',
      templateId: 'profile_interests',
      title: `Your interest map`,
      observation: `Based on what you shared during setup, you're into ${top}${allInterests.length > 4 ? `, and ${allInterests.length - 4} more` : ''}.`,
      pattern: `Your interests span ${profile.hobbies?.length || 0} hobbies, ${profile.entertainment_interests?.length || 0} entertainment preferences, and ${profile.lifestyle_interests?.length || 0} lifestyle areas — that's a rich starting picture.`,
      whyItMakesSense: `People with diverse interests tend to find connections between unrelated fields. Your range gives your companions a lot to work with.`,
      experiment: `Next time you chat, mention one of these interests and see how your companion weaves it into the conversation.`,
      confidence: 'confirmed',
    });
  }

  // Card 2: Music taste
  if (profile.music_genre) {
    cards.push({
      id: 'profile-music',
      templateId: 'profile_music',
      title: `Your sonic identity`,
      observation: `You gravitate toward ${profile.music_genre}. Music taste often mirrors emotional patterns — what we listen to reflects what we need to feel.`,
      pattern: `${profile.music_genre} as a primary genre suggests you use music as an emotional anchor. Whether it's focus, escape, or amplification, your playlists are doing real psychological work.`,
      whyItMakesSense: `Research shows music preference correlates with personality traits — your genre choices aren't random, they're functional.`,
      experiment: `Notice when you reach for music today. What were you feeling right before? That sequence is a data point your companion can track.`,
      confidence: 'confirmed',
    });
  }

  // Card 3: Communication style
  if (profile.communication_profile) {
    const cp = profile.communication_profile;
    const labels: string[] = [];
    if (commLabel('conflict', cp.conflict)) labels.push(commLabel('conflict', cp.conflict)!);
    if (commLabel('connection', cp.connection)) labels.push(commLabel('connection', cp.connection)!);
    if (commLabel('decisionStyle', cp.decisionStyle)) labels.push(commLabel('decisionStyle', cp.decisionStyle)!);
    if (commLabel('motivation', cp.motivation)) labels.push(commLabel('motivation', cp.motivation)!);

    const descParts: string[] = [];
    if (commDesc(cp.conflict)) descParts.push(commDesc(cp.conflict)!);
    if (commDesc(cp.connection)) descParts.push(commDesc(cp.connection)!);

    if (labels.length > 0) {
      cards.push({
        id: 'profile-communication',
        templateId: 'profile_communication',
        title: `How you connect`,
        observation: `Your communication DNA: ${joinList(labels, 4)}.`,
        pattern: descParts.length > 0 ? descParts.join(' ') : 'Your communication preferences shape how every conversation will go.',
        whyItMakesSense: `These aren't random preferences — they're the blueprint for how you process information and build trust. Your companions are tuned to match.`,
        experiment: `In your next conversation, notice whether your companion is matching your style. If something feels off, tell them — they'll adjust.`,
        confidence: 'confirmed',
      });
    }
  }

  // Card 4: Sports & active interests
  const sports = [...(profile.sports || []), ...(profile.sports_interests || [])];
  if (sports.length > 0) {
    cards.push({
      id: 'profile-sports',
      templateId: 'profile_sports',
      title: `Your competitive side`,
      observation: `You follow or play ${joinList(sports, 3)}${sports.length > 3 ? ` and more` : ''}.`,
      pattern: `Following sports — whether as a fan or athlete — often signals a drive for mastery, competition, or community. It's a window into how you engage with goals.`,
      whyItMakesSense: `Sports interest correlates with goal-oriented thinking and team dynamics. Your coach can use this to frame accountability in a language you already speak.`,
      experiment: `Tell your coach about your favorite team or sport. Watch how they translate coaching concepts into that world.`,
      confidence: 'confirmed',
    });
  }

  // Card 5: Tech interests
  if (profile.tech_interests && profile.tech_interests.length > 0) {
    cards.push({
      id: 'profile-tech',
      templateId: 'profile_tech',
      title: `Your tech radar`,
      observation: `You're tuned into ${joinList(profile.tech_interests, 3)}.`,
      pattern: `Tech interests reveal curiosity patterns — you're drawn to how things work, what's coming next, and where the frontier is moving.`,
      whyItMakesSense: `People who track tech trends tend to be early adopters and systems thinkers. Your companions can lean into that by framing ideas as experiments rather than rules.`,
      experiment: `Ask Atlas about a tech topic you follow. Watch how it connects your interest to your goals and daily life.`,
      confidence: 'confirmed',
    });
  }

  // Card 6: Zodiac / personality snapshot
  if (profile.zodiac_sign) {
    cards.push({
      id: 'profile-zodiac',
      templateId: 'profile_zodiac',
      title: `Your ${profile.zodiac_sign} energy`,
      observation: `You're a ${profile.zodiac_sign}. Whether you read horoscopes or not, archetypes give us a shared language for personality patterns.`,
      pattern: `Zodiac signs are a fun lens, not a science — but they do capture something about how people see themselves. Your self-identification matters more than the stars.`,
      whyItMakesSense: `Identity frameworks work because they give us vocabulary for traits we already feel. Your companion knows your sign and can play with the archetype.`,
      experiment: `Ask your companion what they think about your sign's reputation. See if it matches how you actually see yourself.`,
      confidence: 'confirmed',
    });
  }

  // Card 7: Favorite color as personality signal
  if (profile.favorite_color) {
    cards.push({
      id: 'profile-color',
      templateId: 'profile_color',
      title: `${profile.favorite_color} is your anchor`,
      observation: `You chose ${profile.favorite_color} as your favorite color. Color preference is surprisingly stable across a lifetime and often reflects temperament.`,
      pattern: `Color psychology isn't hard science, but preferences do correlate with personality tendencies — warm tones with extroversion, cool tones with introspection, bold colors with confidence.`,
      whyItMakesSense: `Your companion's interface already uses your color choice. It's not just decoration — it's the app adapting to your aesthetic identity.`,
      experiment: `Notice how the app feels in your color versus others. That sense of "this is mine" is the beginning of a digital space that reflects you.`,
      confidence: 'confirmed',
    });
  }

  return cards;
}

export interface ProfileSnapshot {
  interests: { label: string; category: string }[];
  communicationStyle: { dimension: string; value: string; label: string; description: string }[];
  quickFacts: { label: string; value: string }[];
  totalDataPoints: number;
}

export function buildProfileSnapshot(profile: ProfileData): ProfileSnapshot {
  const interests: { label: string; category: string }[] = [];

  for (const h of profile.hobbies || []) interests.push({ label: h, category: 'Hobbies' });
  for (const e of profile.entertainment_interests || []) interests.push({ label: e, category: 'Entertainment' });
  for (const t of profile.tech_interests || []) interests.push({ label: t, category: 'Tech' });
  for (const l of profile.lifestyle_interests || []) interests.push({ label: l, category: 'Lifestyle' });
  for (const s of profile.sports_interests || []) interests.push({ label: s, category: 'Sports' });

  const communicationStyle: { dimension: string; value: string; label: string; description: string }[] = [];
  if (profile.communication_profile) {
    const cp = profile.communication_profile;
    const dims = [
      { key: 'conflict', dimension: 'When upset', value: cp.conflict },
      { key: 'connection', dimension: 'Connection style', value: cp.connection },
      { key: 'decisionStyle', dimension: 'Decision making', value: cp.decisionStyle },
      { key: 'motivation', dimension: 'What drives you', value: cp.motivation },
    ];
    for (const d of dims) {
      const entry = COMMUNICATION_LABELS[d.value];
      if (entry) {
        communicationStyle.push({
          dimension: d.dimension,
          value: d.value,
          label: entry.label,
          description: entry.description,
        });
      }
    }
  }

  const quickFacts: { label: string; value: string }[] = [];
  if (profile.favorite_color) quickFacts.push({ label: 'Favorite Color', value: profile.favorite_color });
  if (profile.zodiac_sign) quickFacts.push({ label: 'Zodiac', value: profile.zodiac_sign });
  if (profile.music_genre) quickFacts.push({ label: 'Music Vibe', value: profile.music_genre });
  if (profile.gender && profile.gender !== 'unspecified') quickFacts.push({ label: 'Identifies as', value: profile.gender });

  let totalDataPoints = interests.length + communicationStyle.length + quickFacts.length;

  return { interests, communicationStyle, quickFacts, totalDataPoints };
}
