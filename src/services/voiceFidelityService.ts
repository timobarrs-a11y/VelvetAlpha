import { supabase } from '../shared/supabase/client';
import { getVoiceById } from '../config/signatureVoices';

/**
 * Voice Fidelity System (drift detection & governed re-anchoring)
 */

export const DRIFT_THRESHOLD = 0.75;
// Minimum gap between inspections — prevents concurrent fires on rapid turn bursts.
const INSPECTION_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

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
  messages_sampled: number;
}

interface CompanionLike {
  id: string;
  user_id?: string;
  gender?: 'male' | 'female';
  signature_voice?: string | null;
  voice_baseline?: string | null;
  drift_checked_at?: string | null;
  drift_needs_correction?: boolean;
}

async function resolveBaseline(companion: CompanionLike): Promise<{ instruction: string; examples: string[] }> {
  const voiceId = companion.signature_voice || (companion.gender === 'male' ? 'classic_male' : 'classic_female');
  const voice = getVoiceById(voiceId);
  // Prefer the seeded baseline (written at creation); fall back to the live voice
  // definition only for companions created before this system was deployed.
  const instruction = companion.voice_baseline || voice?.instruction || '';
  const examples = voice?.examples ?? [];
  return { instruction, examples };
}

/**
 * Seed the voice baseline at companion creation — call this once immediately
 * after a companion is created so the golden fingerprint is always set from a
 * clean onboarding snapshot, never from a potentially-drifted first inspection.
 */
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

/**
 * Run one fidelity inspection for a companion. Safe to call fire-and-forget.
 * Returns the result, or null if it couldn't run or was rate-limited.
 */
export async function inspectVoiceFidelity(
  companion: CompanionLike,
  recentAssistantMessages: string[]
): Promise<VoiceFidelityResult | null> {
  try {
    if (!recentAssistantMessages || recentAssistantMessages.length < 5) return null;

    // Rate-guard: skip if an inspection ran within the last hour. Prevents
    // concurrent fires when a user sends many messages quickly around the 10-turn mark.
    if (companion.drift_checked_at) {
      const lastCheck = new Date(companion.drift_checked_at).getTime();
      if (Date.now() - lastCheck < INSPECTION_COOLDOWN_MS) return null;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const userId = companion.user_id || session.user.id;

    const { instruction, examples } = await resolveBaseline(companion);
    if (!instruction) return null;

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inspect-voice-fidelity`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voiceInstruction: instruction,
        voiceExamples: examples,
        recentMessages: recentAssistantMessages,
        companionId: companion.id,
      }),
    });

    if (!response.ok) {
      console.error('[voiceFidelity] inspector error:', response.status);
      return null;
    }

    const result = (await response.json()) as VoiceFidelityResult;
    const needsCorrection = result.overall < DRIFT_THRESHOLD;

    // Append to the audit trail.
    await supabase.from('companion_drift_log').insert({
      companion_id: companion.id,
      user_id: userId,
      vfs_overall: result.overall,
      vfs_tone: result.scores?.tone,
      vfs_vocabulary: result.scores?.vocabulary,
      vfs_emotional: result.scores?.emotional,
      vfs_energy: result.scores?.energy,
      vfs_boundary: result.scores?.boundary,
      drift_detected: result.drift_detected,
      correction_applied: needsCorrection,
      messages_sampled: result.messages_sampled ?? recentAssistantMessages.length,
      notes: result.notes ?? '',
    });

    // Update the live status the chat reads to decide on re-anchoring.
    await supabase
      .from('companions')
      .update({
        drift_vfs: result.overall,
        drift_needs_correction: needsCorrection,
        drift_checked_at: new Date().toISOString(),
      })
      .eq('id', companion.id);

    return result;
  } catch (error) {
    console.error('[voiceFidelity] inspection failed:', error);
    return null;
  }
}

/** Clear the correction flag once a re-anchored turn has been delivered. */
export async function clearDriftCorrection(companionId: string): Promise<void> {
  try {
    await supabase.from('companions').update({ drift_needs_correction: false }).eq('id', companionId);
  } catch (error) {
    console.error('[voiceFidelity] failed to clear correction flag:', error);
  }
}
