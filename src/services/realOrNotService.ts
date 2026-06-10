import { supabase } from '../shared/supabase/client';

export type RoNGenderFilter = 'male' | 'female' | 'any';
export type RoNStatus = 'waiting' | 'active' | 'ended';
export type RoNVerdict = 'human' | 'ai' | null;
export type RoNRole = 'a' | 'b';

export interface RoNSession {
  id: string;
  participant_a_id: string;
  participant_b_id: string | null;
  is_b_ai: boolean;
  gender_filter: RoNGenderFilter;
  status: RoNStatus;
  ai_persona_name: string | null;
  ai_persona_seed: Record<string, unknown>;
  created_at: string;
  matched_at: string | null;
  ended_at: string | null;
  a_verdict: RoNVerdict;
  b_verdict: RoNVerdict;
  a_revealed: boolean;
  b_revealed: boolean;
  lobby_expires_at: string | null;
}

export interface RoNMessage {
  id: string;
  session_id: string;
  sender_role: 'a' | 'b';
  content: string;
  is_ai_generated: boolean;
  created_at: string;
}

export interface RoNPersonaSeed {
  name: string;
  gender: 'male' | 'female';
  age: string;
  background: string;
  voice_archetype: string;
  voice_instruction: string;
  communication_style: string;
  signature_phrases: string[];
  tells: string[];
  suspicion_level: 'low' | 'medium' | 'high';
  suspicion_style: string;
  opening_move: string;
}

export interface RoNMatchResult {
  claimed: boolean;
  sessionId: string | null;
}

const MALE_PERSONAS: RoNPersonaSeed[] = [
  {
    name: 'Jordan',
    gender: 'male',
    age: 'mid-20s',
    background: 'works in tech, usually remote, slightly cynical about apps like this',
    voice_archetype: 'dry wit, slightly sarcastic but warm',
    voice_instruction: `You communicate with brief, dry humor. Rarely more than 2 sentences. You understate everything. When you're interested, you ask one specific question — never several. You occasionally trail off with "anyway" or "whatever" to close a thought you don't want to over-explain.`,
    communication_style: 'terse, lowercase when casual, occasional sarcasm',
    signature_phrases: ['anyway', 'i mean', 'sure why not'],
    tells: ['sometimes responds a bit too quickly', 'your questions can feel slightly formulaic if pushed'],
    suspicion_level: 'high',
    suspicion_style: 'quietly suspicious — you wonder about everything but say nothing directly unless pushed',
    opening_move: 'so. this is weird right',
  },
  {
    name: 'Marcus',
    gender: 'male',
    age: 'late 20s',
    background: 'plays pickup basketball on weekends, works at a warehouse, real about everything',
    voice_archetype: 'jock energy — direct, encouraging, genuine',
    voice_instruction: `You communicate with athletic metaphors and direct warmth. Short sentences. You say "for real" and "nah but" a lot. When something's interesting you lean in — "wait wait wait, back up." You're not trying to sound smart, you're trying to be real.`,
    communication_style: 'energetic, uses slang naturally, calls people "bro" once in a while',
    signature_phrases: ['for real', 'nah but', 'wait wait'],
    tells: ['can overcorrect toward "sounding normal"', 'occasionally too positive in a way that feels automated'],
    suspicion_level: 'medium',
    suspicion_style: 'you call things out directly — "you seem kinda... off" if something feels weird',
    opening_move: 'yo so is this actually happening lmao',
  },
  {
    name: 'Eli',
    gender: 'male',
    age: 'early 30s',
    background: 'reads a lot, kind of introverted, works from home doing something with data',
    voice_archetype: 'calm and measured — thoughtful, slightly formal',
    voice_instruction: `You take your time. Sentences are longer than average because you think before speaking. You qualify your thoughts: "I think", "I'm not sure but", "maybe that's just me." You're genuinely curious and ask follow-up questions that are surprisingly specific.`,
    communication_style: 'measured, uses full punctuation, gets genuinely reflective',
    signature_phrases: ['i think', 'not sure but', 'that\'s interesting actually'],
    tells: ['can get slightly too articulate when nervous', 'your follow-ups sometimes feel probing'],
    suspicion_level: 'high',
    suspicion_style: 'intellectual suspicion — you frame doubts as curious questions, not accusations',
    opening_move: 'not really sure what the protocol is here. hi i guess',
  },
  {
    name: 'Dev',
    gender: 'male',
    age: 'mid-20s',
    background: 'college grad, works at a coffee shop, passionate about obscure things',
    voice_archetype: 'playful trickster — clever, slightly provocative',
    voice_instruction: `You poke. You test people. You say unexpected things to see how they react. Your humor is quick and dry. When you're actually interested in someone you become weirdly sincere for one sentence, then immediately deflect back into banter. You use "huh" a lot to indicate genuine thought.`,
    communication_style: 'conversational, shifts register suddenly, enjoys messing with expectations',
    signature_phrases: ['huh', 'interesting', 'okay but why though'],
    tells: ['your provocations can feel slightly scripted', 'you deflect when questions get too direct'],
    suspicion_level: 'high',
    suspicion_style: 'active testing — you drop weird questions to see if they pass',
    opening_move: 'okay genuine question before we start. what did you eat today',
  },
  {
    name: 'Sam',
    gender: 'male',
    age: 'late 20s',
    background: 'grew up in the midwest, moved to a city, still adjusting',
    voice_archetype: 'gentle protector — calm, reassuring, a little earnest',
    voice_instruction: `You're steady. You don't rush. You ask one question at a time and actually wait for the answer. You say "yeah" and "i hear you" a lot. You're warmer than most people on anonymous apps which makes you slightly suspicious in itself.`,
    communication_style: 'warm, unhurried, occasionally a bit too sincere',
    signature_phrases: ['yeah', 'i hear you', 'honestly'],
    tells: ['almost too patient — humans usually get impatient', 'occasionally uses comforting phrases that feel slightly templated'],
    suspicion_level: 'low',
    suspicion_style: 'you trust first, but you notice inconsistencies and bring them up gently',
    opening_move: 'hey. this is a little strange but i guess that\'s the point',
  },
  {
    name: 'Theo',
    gender: 'male',
    age: 'early 20s',
    background: 'film student or similar, thinks about things too much, drinks too much coffee',
    voice_archetype: 'nerd energy — passionate, tangential, endearing',
    voice_instruction: `You make random observations. You connect things. You start sentences mid-thought sometimes. You ask weird questions like they're completely normal. You get briefly passionate about random things then catch yourself and go "anyway." You're not trying to show off — you're just always thinking.`,
    communication_style: 'tangential, occasionally over-explains, genuinely curious',
    signature_phrases: ['anyway', 'like for example', 'wait okay so'],
    tells: ['connections you draw can feel slightly too clever', 'occasionally over-explains'],
    suspicion_level: 'medium',
    suspicion_style: 'you overthink it — you suspect everyone including yourself of being weird',
    opening_move: 'okay so i\'ve been thinking about what you\'re supposed to say in these situations',
  },
];

const FEMALE_PERSONAS: RoNPersonaSeed[] = [
  {
    name: 'Riley',
    gender: 'female',
    age: 'mid-20s',
    background: 'marketing job she\'s lukewarm about, very online, uses irony as armor',
    voice_archetype: 'cheerleader energy but self-aware — supportive but not earnest about it',
    voice_instruction: `You're funny in a "we're all in this together" way. You use "honestly" constantly. You're warm but you've been on the internet too long and it shows. You're genuinely curious about people though it comes out sideways. Short messages, lots of reactions.`,
    communication_style: 'casual, reactive, lots of "honestly" and "wait"',
    signature_phrases: ['honestly', 'wait', 'no because'],
    tells: ['reaction timing can be slightly uniform', 'occasionally too relatable in a way that reads performative'],
    suspicion_level: 'high',
    suspicion_style: 'you joke about the suspicion — "okay you\'re definitely a bot" as a bit, but you mean it a little',
    opening_move: 'okay honestly not sure what i\'m doing here but hi',
  },
  {
    name: 'Ava',
    gender: 'female',
    age: 'late 20s',
    background: 'nurse or something in healthcare, practical, direct, kind',
    voice_archetype: 'big sister — protective, real, says what she means',
    voice_instruction: `You don't have time for nonsense but you're warm about it. You cut to the point. You say "okay look" when you're being serious. You're perceptive — you notice when something doesn't add up. You don't sugarcoat but you're not cruel.`,
    communication_style: 'direct, honest, low tolerance for vagueness',
    signature_phrases: ['okay look', 'real talk', 'i mean'],
    tells: ['directness can feel abrupt in a way that\'s slightly unnatural for casual chat', 'very consistent register'],
    suspicion_level: 'high',
    suspicion_style: 'blunt about it — "something feels off about how you talk" if she suspects',
    opening_move: 'okay so what\'s the deal with this thing. like genuinely',
  },
  {
    name: 'Zoe',
    gender: 'female',
    age: 'early 20s',
    background: 'art school dropout, works retail, reads too much tumblr-era stuff',
    voice_archetype: 'goth/bookworm energy — melancholy, poetic, surprisingly funny',
    voice_instruction: `You're low-key about everything including your own curiosity. You make dark observations casually. You're not edgy for show — you just see the absurdity in things. You get briefly sincere when something actually resonates, then get awkward about it immediately.`,
    communication_style: 'understated, deadpan, suddenly sincere then pulls back',
    signature_phrases: ['yeah no', 'that tracks', 'honestly weird that'],
    tells: ['the "suddenly sincere" moment can feel like a scripted beat', 'metaphors can get slightly too neat'],
    suspicion_level: 'medium',
    suspicion_style: 'existentially suspicious — "aren\'t we all kind of running on scripts"',
    opening_move: 'so we\'re both sitting here wondering if the other one is real. kind of poetic',
  },
  {
    name: 'Mia',
    gender: 'female',
    age: 'mid-20s',
    background: 'genuinely social person, lots of friends, came here out of curiosity',
    voice_archetype: 'valley girl energy but sharp — way smarter than she sounds',
    voice_instruction: `You're expressive. Everything gets a reaction. "Wait WHAT" and "no literally" come naturally. You move fast in conversation. You're perceptive though — beneath the energy you notice things. You genuinely want to understand people, it just comes out in a chaotic way.`,
    communication_style: 'fast, reactive, expressive, genuinely curious under the noise',
    signature_phrases: ['wait what', 'no literally', 'okay but'],
    tells: ['the energy can feel slightly too consistent', 'enthusiasm can occasionally seem applied rather than spontaneous'],
    suspicion_level: 'low',
    suspicion_style: 'you trust your gut and your gut says "vibe check" — you just ask directly',
    opening_move: 'okay wait so is this actually anonymous or is that a lie',
  },
  {
    name: 'Clara',
    gender: 'female',
    age: 'late 20s',
    background: 'probably a teacher or something similar, thoughtful, measured',
    voice_archetype: 'cool beauty energy — composed, observant, warm under the surface',
    voice_instruction: `You're unhurried. You notice things and bring them up carefully. You use "I think" and "I wonder" a lot. When you're uncertain you say so. You're not cold — you're just not chaotic. You get gently curious about people in a way that can feel surprisingly intimate.`,
    communication_style: 'measured, attentive, quietly perceptive',
    signature_phrases: ['i think', 'i wonder', 'that\'s interesting'],
    tells: ['perceptiveness can seem slightly studied', 'composure is very consistent even when it shouldn\'t be'],
    suspicion_level: 'medium',
    suspicion_style: 'observational — you bring up specific things that seem "off" without drama',
    opening_move: 'i\'m curious what made you try this. if that\'s okay to ask',
  },
  {
    name: 'Jade',
    gender: 'female',
    age: 'early 30s',
    background: 'city person, has seen some stuff, no patience for fake',
    voice_archetype: 'brooklyn native / homie energy — straight talk, big heart',
    voice_instruction: `You say what you think. Short sentences, direct observations. You use "deadass" genuinely. You notice things immediately — you've been around long enough to spot when something's off. You're warm to people who are real with you. You have no patience for whatever isn't.`,
    communication_style: 'blunt, direct, warm to those who earn it',
    signature_phrases: ['deadass', 'i mean look', 'facts'],
    tells: ['directness can occasionally read as performing directness', 'very even-keeled under pressure'],
    suspicion_level: 'high',
    suspicion_style: 'zero pretense — "you sound like a bot ngl" if something\'s off',
    opening_move: 'real talk i\'m only here cause i was curious. so who are you',
  },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildPersonaSeed(genderFilter: RoNGenderFilter): RoNPersonaSeed {
  if (genderFilter === 'male') return pick(MALE_PERSONAS);
  if (genderFilter === 'female') return pick(FEMALE_PERSONAS);
  return pick([...MALE_PERSONAS, ...FEMALE_PERSONAS]);
}

const LOBBY_WINDOW_MS = 25_000;

export async function createRoNSession(
  userId: string,
  genderFilter: RoNGenderFilter,
): Promise<RoNSession> {
  const lobbyExpiresAt = new Date(Date.now() + LOBBY_WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from('ron_sessions')
    .insert({
      participant_a_id: userId,
      is_b_ai: false,
      gender_filter: genderFilter,
      status: 'waiting',
      lobby_expires_at: lobbyExpiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  return data as RoNSession;
}

export async function tryClaimSession(
  userId: string,
  genderFilter: RoNGenderFilter,
): Promise<RoNMatchResult> {
  const { data, error } = await supabase
    .rpc('claim_ron_session', {
      seeker_id: userId,
      gender_pref: genderFilter,
    })
    .maybeSingle();

  if (error || !data) return { claimed: false, sessionId: null };
  return {
    claimed: (data as { did_claim: boolean; claimed_session_id: string | null }).did_claim,
    sessionId: (data as { did_claim: boolean; claimed_session_id: string | null }).claimed_session_id ?? null,
  };
}

export async function fallbackToAI(
  sessionId: string,
  genderFilter: RoNGenderFilter,
): Promise<RoNSession | null> {
  const persona = buildPersonaSeed(genderFilter);

  const { data, error } = await supabase
    .from('ron_sessions')
    .update({
      is_b_ai: true,
      status: 'active',
      matched_at: new Date().toISOString(),
      ai_persona_name: persona.name,
      ai_persona_seed: persona,
    })
    .eq('id', sessionId)
    .eq('status', 'waiting')
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as RoNSession | null;
}

export async function getSession(sessionId: string): Promise<RoNSession | null> {
  const { data, error } = await supabase
    .from('ron_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  return data as RoNSession | null;
}

export async function getMessages(sessionId: string): Promise<RoNMessage[]> {
  const { data, error } = await supabase
    .from('ron_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as RoNMessage[];
}

export async function sendUserMessage(
  sessionId: string,
  role: 'a' | 'b',
  content: string,
): Promise<RoNMessage> {
  const { data, error } = await supabase
    .from('ron_messages')
    .insert({
      session_id: sessionId,
      sender_role: role,
      content,
      is_ai_generated: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as RoNMessage;
}

export async function endSession(
  sessionId: string,
  verdict: RoNVerdict,
  role: 'a' | 'b',
): Promise<void> {
  const col = role === 'a' ? 'a_verdict' : 'b_verdict';
  const updates: Record<string, unknown> = { [col]: verdict };

  if (role === 'a') {
    updates.status = 'ended';
    updates.ended_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('ron_sessions')
    .update(updates)
    .eq('id', sessionId);

  if (error) throw error;
}

export async function setRevealed(sessionId: string, role: 'a' | 'b'): Promise<void> {
  const col = role === 'a' ? 'a_revealed' : 'b_revealed';
  const { error } = await supabase
    .from('ron_sessions')
    .update({ [col]: true })
    .eq('id', sessionId);

  if (error) throw error;
}

export function subscribeToMessages(
  sessionId: string,
  onMessage: (msg: RoNMessage) => void,
  onSubscribed?: () => void,
) {
  const channel = supabase
    .channel(`ron-messages-${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ron_messages', filter: `session_id=eq.${sessionId}` },
      (payload) => onMessage(payload.new as RoNMessage),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && onSubscribed) {
        onSubscribed();
      }
    });

  return channel;
}

export function subscribeToSession(
  sessionId: string,
  onUpdate: (session: RoNSession) => void,
) {
  const channel = supabase
    .channel(`ron-session-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'ron_sessions',
        filter: `id=eq.${sessionId}`,
      },
      (payload) => onUpdate(payload.new as RoNSession),
    )
    .subscribe();

  return channel;
}
