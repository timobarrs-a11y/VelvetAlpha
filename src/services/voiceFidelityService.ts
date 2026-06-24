import { supabase } from '../shared/supabase/client';
import { getVoiceById } from '../config/signatureVoices';

/**
 * Voice Fidelity System (drift detection & governed re-anchoring)
 *
 * Scores a companion's recent messages against its frozen signature-voice
 * baseline ("golden fingerprint"). Runs async, never in the chat hot path.
 *
 * Flow: resolve baseline -> call inspector edge function -> log result ->
 * update the companion's live drift status (read later by the chat to decide
 * whether to re-anchor the system prompt).
 */

// Below this overall Voice Fidelity Score, the companion is re-anchored on its
// next turn. Tuned conservative — only correct when drift is clearly visible.
export const DRIFT_THRESHOLD = 0.75;

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
}

/**
 * The baseline is frozen once and reused forever, so the reference itself never
 * drifts. First run derives it from the signature voice and persists it.
 */
async function resolveBaseline(companion: CompanionLike): Promise<{ instruction: string; examples: string[] }> {
  const voiceId = companion.signature_voice || (companion.gender === 'male' ? 'classic_male' : 'classic_female');
  const voice = getVoiceById(voiceId);
  const instruction = companion.voice_baseline || voice?.instruction || '';
  const examples = voice?.examples ?? [];

  // Freeze the baseline on first inspection so it can never move later.
  if (!companion.voice_baseline && instruction) {
    await supabase.from('companions').update({ voice_baseline: instruction }).eq('id', companion.id);
  }

  return { instruction, examples };
}

/**
 * Run one fidelity inspection for a companion. Safe to call fire-and-forget.
 * Returns the result, or null if it couldn't run (e.g. no auth / no baseline).
 */
export async function inspectVoiceFidelity(
  companion: CompanionLike,
  recentAssistantMessages: string[]
): Promise<VoiceFidelityResult | null> {
  try {
    if (!recentAssistantMessages || recentAssistantMessages.length < 5) return null;

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
