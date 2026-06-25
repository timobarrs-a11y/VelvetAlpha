import { supabase } from '../shared/supabase/client';
import { getVoiceById } from '../config/signatureVoices';
import type { Companion } from './companionService';

export interface VoiceFidelityScores {
  tone: number;
  vocabulary: number;
  emotional: number;
  energy: number;
  boundary: number;
}

export interface VoiceFidelityResult {
  scores: VoiceFidelityScores;
  overall: number;
  drift_detected: boolean;
  notes: string;
}

const DRIFT_THRESHOLD = 0.75;
const INSPECTION_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

async function resolveVoiceBaseline(companion: Companion): Promise<string> {
  if (companion.voice_baseline) return companion.voice_baseline;
  const voiceId = companion.signature_voice ?? 'classic_female';
  return getVoiceById(voiceId).instruction;
}

export async function seedVoiceBaseline(
  companionId: string,
  signatureVoiceId: string,
  gender: 'male' | 'female'
): Promise<void> {
  try {
    const voiceId = signatureVoiceId || (gender === 'male' ? 'classic_male' : 'classic_female');
    const voice = getVoiceById(voiceId);
    if (!voice?.instruction) return;
    await supabase.from('companions').update({ voice_baseline: voice.instruction }).eq('id', companionId);
  } catch (error) {
    console.error('[voiceFidelity] failed to seed baseline:', error);
  }
}

export async function inspectVoiceFidelity(
  companion: Companion,
  recentAssistantMessages: string[]
): Promise<VoiceFidelityResult | null> {
  try {
    if (companion.drift_checked_at) {
      const lastCheck = new Date(companion.drift_checked_at).getTime();
      if (Date.now() - lastCheck < INSPECTION_COOLDOWN_MS) return null;
    }

    const voiceBaseline = await resolveVoiceBaseline(companion);
    const voice = getVoiceById(companion.signature_voice ?? 'classic_female');

    const recentMessages = recentAssistantMessages.map((content) => ({
      role: 'assistant',
      content,
    }));

    const { data, error } = await supabase.functions.invoke('inspect-voice-fidelity', {
      body: {
        voiceInstruction: voiceBaseline,
        voiceExamples: voice.examples ?? [],
        recentMessages,
        companionId: companion.id,
      },
    });

    if (error) throw error;

    const result = data as VoiceFidelityResult;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return result;

    await Promise.all([
      supabase.from('companion_drift_log').insert({
        companion_id: companion.id,
        user_id: user.id,
        vfs_overall: result.overall,
        vfs_tone: result.scores.tone,
        vfs_vocabulary: result.scores.vocabulary,
        vfs_emotional: result.scores.emotional,
        vfs_energy: result.scores.energy,
        vfs_boundary: result.scores.boundary,
        drift_detected: result.drift_detected,
        correction_applied: false,
        messages_sampled: recentAssistantMessages.length,
        notes: result.notes,
      }),
      supabase
        .from('companions')
        .update({
          drift_vfs: result.overall,
          drift_needs_correction: result.overall < DRIFT_THRESHOLD,
          drift_checked_at: new Date().toISOString(),
        })
        .eq('id', companion.id),
    ]);

    return result;
  } catch (error) {
    console.error('[voiceFidelityService] inspectVoiceFidelity failed:', error);
    return null;
  }
}

export async function clearDriftCorrection(companionId: string): Promise<void> {
  await supabase
    .from('companions')
    .update({ drift_needs_correction: false })
    .eq('id', companionId);
}
