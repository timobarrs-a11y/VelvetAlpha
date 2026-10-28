import { createCompanion, type Companion } from './companionService';
import { ambientProfileService } from './ambientProfileService';
import { seedVoiceBaseline } from './voiceFidelityService';
import type { UserProfile } from './userProfileService';

/**
 * The one place a companion is made from the companion questionnaire's answers: the ones a person gave
 * and the ones picked for them at random (Velvet Rope) go through the same code, so the two can't drift apart.
 */

/** What each humor pick is saved as: the words the chat prompt and the house line banks match on. */
export const HUMOR_TEXT: Record<string, string> = {
  witty: 'Witty & Clever',
  goofy: 'Goofy & Random',
  dry: 'Sarcastic & Dry',
  warm: 'Warm & Light',
};
export const FLIRTING_TEXT: Record<string, string> = {
  bold: 'Direct & Bold',
  sweet: 'Subtle & Sweet',
  banter: 'Playful Teasing',
  deep: 'Mysterious & Reserved',
};
/** How much she writes with her hands (emoji, actions) follows how big her energy is; it is not asked separately. */
function expressivenessFor(energy: string | undefined): string | undefined {
  if (!energy) return undefined;
  const e = energy.toLowerCase();
  return e.includes('life of the party') ? 'Very Animated' : e.includes('own world') ? 'Subtle & Minimal' : 'Balanced Expression';
}
/** One or two humor picks, the main one first: "Witty & Clever + Warm & Light". */
function humorFor(picks: string | string[] | undefined): string | undefined {
  const list = (Array.isArray(picks) ? picks : picks ? [picks] : []).map(v => HUMOR_TEXT[v]).filter(Boolean);
  return list.length ? list.slice(0, 2).join(' + ') : undefined;
}

type Answers = Record<string, string | string[]>;

export function matchDataFromAnswers(answers: Answers, profile: Partial<UserProfile> | null) {
  const a = answers as Record<string, string>;
  const connection: 'friend' | 'romantic' = a.connectionType?.includes('friend') ? 'friend' : 'romantic';
  const interests = Array.isArray(answers.interests) ? [...new Set(answers.interests as string[])] : [];
  // Only what was asked or worked out from it. Love language and "when it's hard" come in the first week of
  // chat (companionWeekOne.ts); everything else stays empty rather than being filled with a made-up answer.
  // Friends are not asked how they flirt, so they have no flirting style.
  return {
    userName: profile?.name || '',
    userBirthday: profile?.birthday || '',
    userGender: profile?.gender || '',
    relationshipType: a.relationshipType as 'Male' | 'Female',
    connectionType: connection,
    energyPreference: a.energy,
    flirtingStyle: connection === 'romantic' ? FLIRTING_TEXT[a.warmth] : undefined,
    humorStyle: humorFor(answers.humor),
    communicationStyle: a.directness,
    emotionalOpenness: a.openness,
    supportStyle: a.care,
    expressiveness: expressivenessFor(a.energy),
    interestPreference: interests[0] ?? (typeof answers.interests === 'string' ? answers.interests : ''),
    companionName: a.companionName || '',
    favoriteColor: profile?.favorite_color || '',
    hobbies: interests.join(', '),
    musicGenre: profile?.music_genre || '',
    newsTopics: profile?.news_categories || [],
  };
}

/** Makes the companion and everything that comes with it, or returns null. */
export async function createCompanionFromAnswers(userId: string, answers: Answers, profile: Partial<UserProfile> | null): Promise<Companion | null> {
  const a = answers as Record<string, string>;
  const gender: 'male' | 'female' = a.relationshipType === 'Male' ? 'male' : 'female';
  const matchData = matchDataFromAnswers(answers, profile);
  const interests = Array.isArray(answers.interests) ? [...new Set(answers.interests as string[])] : [];
  const signatureVoice = typeof a.signatureVoice === 'string' && a.signatureVoice ? a.signatureVoice : undefined;

  sessionStorage.setItem('matchAnswers', JSON.stringify(matchData));

  const companion = await createCompanion({
    userId,
    gender,
    relationshipType: matchData.connectionType,
    customName: matchData.companionName,
    hobbies: interests,
    interestPreference: matchData.interestPreference,
    interestText: matchData.interestPreference,
    energyPreference: matchData.energyPreference,
    flirtingStyle: matchData.flirtingStyle,
    humorStyle: matchData.humorStyle,
    communicationStyle: matchData.communicationStyle,
    emotionalOpenness: matchData.emotionalOpenness,
    supportStyle: matchData.supportStyle,
    expressiveness: matchData.expressiveness,
    favoriteColor: matchData.favoriteColor,
    musicGenre: matchData.musicGenre,
    newsCategories: matchData.newsTopics,
    signatureVoice,
    signatureExpert: sessionStorage.getItem('selectedExpertId') || undefined,
    signatureExpertSource: (sessionStorage.getItem('selectedExpertSource') as 'curated' | 'user') || undefined,
    questionnaireData: matchData,
  });

  if (!companion || !companion.id) return null;

  sessionStorage.setItem('currentCompanionId', companion.id);
  // A look drafted for an earlier companion must never turn up on this one.
  try { localStorage.removeItem('companion-avatar-draft'); } catch { /* storage blocked */ }
  if (signatureVoice) seedVoiceBaseline(companion.id, signatureVoice, gender).catch(() => {});
  ambientProfileService.seedFromQuestionnaire(userId, answers).catch(() => {});
  return companion;
}
