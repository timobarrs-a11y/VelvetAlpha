import type { UserProfile, UserProfileUpdate } from '../../services/userProfileService';
import type { QuestionnaireDefinition, QuestionContext } from './types';
import { INTEREST_KEYS, answersFromSomeday, somedayFromAnswers, type SomedayPick } from './personalBank';

// Act 1 saves each answer the moment it's given, and picks up where someone
// left off. These map between the questionnaire's answers and the profile.

type Answers = Record<string, string | string[]>;

const PLACEHOLDER_NAMES = new Set(['babe', 'there']);

function list(answer: string | string[] | undefined): string[] {
  if (Array.isArray(answer)) return answer;
  if (typeof answer === 'string' && answer) return answer.split(',').map(v => v.trim()).filter(Boolean);
  return [];
}

/**
 * The profile columns one answer writes, or null for answers that save nothing
 * (the birthday is set at sign-up and can't be written by the app).
 */
export function profileUpdateFor(questionId: string, answer: string | string[], all: Answers): UserProfileUpdate | null {
  const text = typeof answer === 'string' ? answer.trim() : '';
  switch (questionId) {
    case 'name': return text ? { name: text } : null;
    case 'nickname': return { nickname: text || null };
    case 'favoriteColor': return text ? { favorite_color: text } : null;
    // Skipping clears it, so a changed mind sticks.
    case 'favoriteHero': return { favorite_superhero: text || null };
    case 'zodiacCusp':
    case 'zodiacConfirm': return { zodiac_sign: text && text !== 'none' ? text : null };
    case 'gender': return text ? { gender: text } : null;
    case 'hobbies': return { hobbies: list(answer) };
    case 'musicGenre': return { music_genre: list(answer).join(', ') || null };
    case 'entertainmentInterests': return { entertainment_interests: list(answer) };
    case 'techInterests': return { tech_interests: list(answer) };
    case 'lifestyleInterests': return { lifestyle_interests: list(answer) };
    case 'sportsInterests': return { sports_interests: list(answer), sports: list(answer) };
    default:
      if (questionId.startsWith('someday_')) return { someday: somedayFromAnswers(all) };
      return null;
  }
}

/** A saved profile back into the questionnaire's answers. */
export function answersFromProfile(profile: Partial<UserProfile> | null): Answers {
  if (!profile) return {};
  const out: Answers = {};
  if (profile.name && !PLACEHOLDER_NAMES.has(profile.name.toLowerCase())) out.name = profile.name;
  if (profile.favorite_color) out.favoriteColor = profile.favorite_color;
  if (profile.favorite_superhero) out.favoriteHero = profile.favorite_superhero;
  if (profile.nickname) out.nickname = profile.nickname;
  if (profile.birthday) out.birthday = profile.birthday;
  if (profile.zodiac_sign) {
    out.zodiacCusp = profile.zodiac_sign;
    out.zodiacConfirm = profile.zodiac_sign;
  }
  if (profile.gender) out.gender = profile.gender;
  const interests: Record<(typeof INTEREST_KEYS)[number], string[]> = {
    hobbies: list(profile.hobbies as string[] | string | undefined),
    musicGenre: list(profile.music_genre ?? undefined),
    entertainmentInterests: profile.entertainment_interests ?? [],
    techInterests: profile.tech_interests ?? [],
    lifestyleInterests: profile.lifestyle_interests ?? [],
    sportsInterests: profile.sports_interests ?? [],
  };
  for (const key of INTEREST_KEYS) if (interests[key].length) out[key] = interests[key];
  if (INTEREST_KEYS.some(k => out[k])) out.interests = INTEREST_KEYS.flatMap(k => list(out[k]));
  const someday = (profile.someday ?? []) as SomedayPick[];
  if (someday.length) {
    Object.assign(out, answersFromSomeday(someday));
    out.someday = someday.map(p => p.value);
  }
  return out;
}

/**
 * Where to pick up: the first question that's neither answered nor skipped.
 * An optional question (the nickname) counts as answered once a later one is.
 */
export function resumeIndex(definition: QuestionnaireDefinition, answers: Answers, context: QuestionContext): number {
  const answered = (id: string) => {
    const a = answers[id];
    return Array.isArray(a) ? a.length > 0 : typeof a === 'string' && a.length > 0;
  };
  const ctx = { ...context, answers };
  const questions = definition.questions;
  // Only answers they gave count: a skipped question (the birthday from
  // sign-up) says nothing about how far they got.
  let lastAnswered = -1;
  questions.forEach((q, i) => { if (answered(q.id) && !q.skipIf?.(ctx)) lastAnswered = i; });
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q.skipIf?.(ctx) || answered(q.id)) continue;
    if (i < lastAnswered && !q.required) continue; // optional, already passed
    return i;
  }
  return questions.length - 1;
}
