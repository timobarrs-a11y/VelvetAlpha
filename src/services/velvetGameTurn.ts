import { supabase } from '../shared/supabase/client';

// One AI turn for the Velvet Sims companion, through the `velvet-game-turn` edge function.
const GAME_TURN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/velvet-game-turn`;

export type GameError = Error & { code?: string };

function gameError(code: string): GameError {
  const err = new Error(code) as GameError;
  err.code = code;
  return err;
}

export async function sampleGameTurn(companionId: string, input: unknown, signal?: AbortSignal): Promise<{ text: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw gameError('unavailable');

  let res: Response;
  try {
    res = await fetch(GAME_TURN_URL, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ companionId, input }),
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw gameError('cancelled');
    throw gameError('unavailable');
  }

  const data = await res.json().catch(() => null);
  if (data?.error === 'budget') throw gameError('budget');
  if (data?.error === 'blocked') throw gameError('blocked');
  if (res.status === 429 || data?.error === 'rate_limited') throw gameError('rate_limited');
  if (data?.error === 'refused') throw gameError('refused');
  if (!res.ok || typeof data?.text !== 'string') throw gameError('unavailable');
  return { text: data.text };
}
