import { supabase } from '../shared/supabase/client';

export type OpenerSituation =
  | 'first_match'
  | 'daily_morning'
  | 'daily_evening'
  | 'daily_night'
  | 'reconnect';

/**
 * Ask the edge function for a persona-driven opener (first message / daily
 * check-in), generated in the companion's real voice + character.
 *
 * Returns null on ANY failure (no auth, network, model refusal, empty result)
 * so callers can fall back to their existing templates and never block.
 */
export async function generateOpener(
  companionId: string,
  situation: OpenerSituation,
): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;

    const url = import.meta.env.VITE_SUPABASE_URL;
    const resp = await fetch(`${url}/functions/v1/generate-opener`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ companionId, situation }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const msg = typeof data?.message === 'string' ? data.message.trim() : '';
    return msg.length > 0 ? msg : null;
  } catch {
    return null;
  }
}
