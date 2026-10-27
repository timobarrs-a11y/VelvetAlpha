import { supabase } from '../shared/supabase/client';
import type { DesignOp } from '../games/velvet-house/bridge/protocol';

// Sharing Velvet Sims garment designs: the database functions in
// supabase/migrations/20261029100001_velvet_designs.sql and the `velvet-design-share` edge function.

const SHARE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/velvet-design-share`;

export interface DesignsAnswer { ok: boolean; data?: unknown; error?: string }

const fail = (error: string): DesignsAnswer => ({ ok: false, error });

const CODE = /^VH-[0-9A-Z]{4}(-[0-9A-Z]{1,5})+$/;
const ERRORS = ['bad_visibility', 'bad_name', 'bad_code', 'banned', 'too_many', 'slow_down', 'blocked', 'not_allowed', 'not_signed_in'];

/** Maps a database error to a short code the game has words for. */
export function designError(message: string | undefined): string {
  return ERRORS.find((e) => (message ?? '').includes(e)) ?? 'unavailable';
}

async function publish(args: Record<string, string | number | boolean>): Promise<DesignsAnswer> {
  const name = typeof args.name === 'string' ? args.name : '';
  const code = typeof args.code === 'string' ? args.code.trim().toUpperCase() : '';
  const visibility = typeof args.visibility === 'string' ? args.visibility : '';
  if (!name.trim() || !CODE.test(code) || !['private', 'friends', 'public'].includes(visibility)) return fail('bad_request');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return fail('unavailable');
  let res: Response;
  try {
    res = await fetch(SHARE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ name, code, visibility }),
    });
  } catch { return fail('unavailable'); }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.error) return fail(typeof body?.error === 'string' ? designError(body.error) : 'unavailable');
  return { ok: true, data: { id: body.id, status: body.status } };
}

/** Runs one request from the game with the player's account. Every argument is checked again here. */
export async function runDesignsOp(op: DesignOp, args: Record<string, string | number | boolean> = {}): Promise<DesignsAnswer> {
  const str = (k: string, max: number): string => (typeof args[k] === 'string' ? (args[k] as string).slice(0, max) : '');
  const rpc = async (fn: string, params?: Record<string, unknown>): Promise<DesignsAnswer> => {
    const { data, error } = await supabase.rpc(fn, params);
    return error ? fail(designError(error.message)) : { ok: true, data };
  };
  try {
    switch (op) {
      case 'caps': { const r = await rpc('velvet_designs_is_moderator'); return r.ok ? { ok: true, data: { moderator: r.data === true } } : { ok: true, data: { moderator: false } }; }
      case 'friends': return rpc('velvet_designs_from_friends');
      case 'gallery': return rpc('velvet_designs_gallery', { p_limit: 40, p_offset: typeof args.offset === 'number' ? Math.max(0, Math.floor(args.offset)) : 0 });
      case 'mine': return rpc('velvet_designs_mine');
      case 'publish': return publish(args);
      case 'delete': return rpc('velvet_design_delete', { p_id: str('id', 40) });
      case 'report': return rpc('velvet_design_report', { p_id: str('id', 40), p_reason: str('reason', 200) });
      case 'pending': return rpc('velvet_designs_pending');
      case 'review': return rpc('velvet_design_review', { p_id: str('id', 40), p_approve: args.approve === true });
    }
  } catch {
    return fail('unavailable');
  }
}
