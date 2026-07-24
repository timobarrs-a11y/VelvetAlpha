import { supabase } from '../shared/supabase/client';

export type OpenerSituation =
  | 'first_match'
  | 'daily_morning'
  | 'daily_evening'
  | 'daily_night'
  | 'reconnect';

/**
 * Generates a persona-aware opener by calling the generate-opener edge function.
 * Returns null on any failure so callers can fall back to existing templates.
 */
export async function generateOpener(
  companionId: string,
  situation: OpenerSituation
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
