import { supabase } from '../shared/supabase/client';
import { userProfileService } from './userProfileService';
import { createCompanionFromAnswers } from './companionFromAnswers';
import { randomMatchAnswers } from '../utils/companionRandomizer';
import { voiceAttire } from '../config/voiceAttire';
import { coherentRandomize } from '../components/AvatarCreatorV2';
import { sanitizeAvatarConfigForSave } from './avatarSaveService';
import { advanceSetupStepIf } from './setupProgressService';
import { takeReturnToHouse, HOUSE_ROUTE } from './velvetHouseReturn';
import type { AvatarConfigV2 } from '../types/avatar-v2';

export interface RandomCompanion {
  id: string;
  name: string;
  avatar: AvatarConfigV2;
  /** Where to go after meeting them: the chat, or back to the house they came from. */
  to: string;
}

/** Ends the companion pipeline: setup is done, nothing from it is left behind. */
export async function finishCompanionPipeline(userId: string): Promise<void> {
  await advanceSetupStepIf(userId, ['companion_in_progress', 'choose_conversation'], 'complete');
  for (const key of ['currentCompanionId', 'matchAnswers', 'companionRandomized', 'envSetupNextRoute', 'envSetupBackRoute']) {
    sessionStorage.removeItem(key);
  }
}

/** Where a finished companion lands: back in the house if they came from there, else in the chat with them. */
export function companionDestination(companionId: string): string {
  return takeReturnToHouse() ? HOUSE_ROUTE : `/chat?companion=${companionId}`;
}

/** A match that has been picked but not kept: nothing is saved until the person approves it. */
export interface RandomCandidate {
  gender: 'male' | 'female';
  connection: 'friend' | 'romantic';
  answers: Record<string, string | string[]>;
  name: string;
  voiceId: string;
  avatar: AvatarConfigV2;
}

/**
 * "Let us matchmake for you": all they chose was the gender and friend or companion. Personality, name,
 * signature voice (any of them) and look are picked at random, the look in the attire its voice comes dressed in.
 * Nothing is saved here, so "someone else" is just another roll and leaves nothing behind.
 */
export function rollRandomCandidate(gender: 'male' | 'female', connection: 'friend' | 'romantic'): RandomCandidate {
  const answers = randomMatchAnswers(gender, connection);
  const voiceId = String(answers.signatureVoice ?? '');
  return {
    gender,
    connection,
    answers,
    name: String(answers.companionName),
    voiceId,
    avatar: { ...coherentRandomize(gender), ...voiceAttire(voiceId) },
  };
}

/** The person approved this match: save it and end the pipeline. They land in the chat (or back in the house). */
export async function saveRandomCandidate(candidate: RandomCandidate): Promise<RandomCompanion> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const profile = await userProfileService.getCurrentProfile().catch(() => null);
  const companion = await createCompanionFromAnswers(user.id, candidate.answers, profile);
  if (!companion) throw new Error('The companion could not be created');

  const avatar = await sanitizeAvatarConfigForSave(candidate.avatar, companion.id);
  const { error } = await supabase.from('companions').update({ avatar_config: avatar }).eq('id', companion.id);
  if (error) throw error;

  await finishCompanionPipeline(user.id);
  return { id: companion.id, name: candidate.name, avatar, to: companionDestination(companion.id) };
}
