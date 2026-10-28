import { createCompanion, type Companion } from './companionService';
import { ambientProfileService } from './ambientProfileService';
import { seedVoiceBaseline } from './voiceFidelityService';
import type { UserProfile } from './userProfileService';

/**
 * The one place a companion is made from the companion questionnaire's answers: the ones a person gave
 * and the ones picked for them at random (Velvet Rope) go through the same code, so the two can't drift apart.
 */

/** How they text, worked out from how they show they care (the two used to be asked separately and said the same thing). */
export const COMMUNICATION_FROM_WARMTH: Record<string, string> = {
  bold: 'direct',
  sweet: 'gentle',
  banter: 'playful',
  deep: 'mysterious',
};

type Answers = Record<string, string | string[]>;

export function matchDataFromAnswers(answers: Answers, profile: Partial<UserProfile> | null) {
  const a = answers as Record<string, string>;
  const connection: 'friend' | 'romantic' = a.connectionType?.includes('friend') ? 'friend' : 'romantic';
  const interests = Array.isArray(answers.interests) ? [...new Set(answers.interests as string[])] : [];
  return {
    userName: profile?.name || '',
    userBirthday: profile?.birthday || '',
    userGender: profile?.gender || '',
    relationshipType: a.relationshipType as 'Male' | 'Female',
    connectionType: connection,
    energyPreference: a.energy,
    flirtingStyle: a.warmth,
    humorStyle: a.warmth,
    communicationStyle: COMMUNICATION_FROM_WARMTH[a.warmth] ?? 'gentle',
    emotionalOpenness: 'Opens Up Over Time',
    conversationDepth: 'Perfect Mix Of Both',
    expressiveness: 'Balanced Expression',
    initiative: 'You Both Share',
    interestPreference: interests[0] ?? (typeof answers.interests === 'string' ? answers.interests : ''),
    loveLanguage: a.loveLanguage,
    supportStyle: 'Just Listens & Validates Feelings',
    lifeContext: 'Doing Well',
    confrontationStyle: a.whenItsHard,
    availabilityLevel: 'Mostly Available',
    dynamicPreference: 'You Both Share Control Equally',
    companionName: a.companionName || '',
    favoriteColor: profile?.favorite_color || '',
    hobbies: interests.join(', '),
    sports: Array.isArray(answers.tasteDeck) ? (answers.tasteDeck as string[]).join(', ') : '',
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
  const tasteDeck = Array.isArray(answers.tasteDeck) ? (answers.tasteDeck as string[]) : [];
  const signatureVoice = typeof a.signatureVoice === 'string' && a.signatureVoice ? a.signatureVoice : undefined;

  sessionStorage.setItem('matchAnswers', JSON.stringify(matchData));

  const companion = await createCompanion({
    userId,
    gender,
    relationshipType: matchData.connectionType,
    customName: matchData.companionName,
    hobbies: interests,
    sports: tasteDeck,
    dynamicPreference: matchData.dynamicPreference,
    confrontationStyle: matchData.confrontationStyle,
    availabilityLevel: matchData.availabilityLevel,
    interestPreference: matchData.interestPreference,
    interestText: matchData.interestPreference,
    loveLanguage: matchData.loveLanguage,
    supportStyle: matchData.supportStyle,
    lifeContext: matchData.lifeContext,
    energyPreference: matchData.energyPreference,
    flirtingStyle: matchData.flirtingStyle,
    humorStyle: matchData.humorStyle,
    communicationStyle: matchData.communicationStyle,
    emotionalOpenness: matchData.emotionalOpenness,
    conversationDepth: matchData.conversationDepth,
    expressiveness: matchData.expressiveness,
    initiative: matchData.initiative,
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
