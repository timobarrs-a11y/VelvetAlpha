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

/**
 * "From inside the Velvet Rope": all they chose was the gender and friend or companion. Personality, name,
 * signature voice (any of them) and look are picked at random, saved, and the pipeline is over. There is
 * nothing to answer and nothing left to set up.
 */
export async function createRandomCompanion(gender: 'male' | 'female', connection: 'friend' | 'romantic'): Promise<RandomCompanion> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const profile = await userProfileService.getCurrentProfile().catch(() => null);
  const answers = randomMatchAnswers(gender, connection);

  const companion = await createCompanionFromAnswers(user.id, answers, profile);
  if (!companion) throw new Error('The companion could not be created');

  // Made in the attire its voice comes dressed in.
  const dressed = { ...coherentRandomize(gender), ...voiceAttire(String(answers.signatureVoice ?? '')) };
  const avatar = await sanitizeAvatarConfigForSave(dressed, companion.id);
  const { error } = await supabase.from('companions').update({ avatar_config: avatar }).eq('id', companion.id);
  if (error) throw error;

  await finishCompanionPipeline(user.id);
  return { id: companion.id, name: String(answers.companionName), avatar, to: companionDestination(companion.id) };
}
