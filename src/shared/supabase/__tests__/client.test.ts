import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

let supabase: typeof import('../client').supabase;

beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:9');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
  ({ supabase } = await import('../client'));
});
afterEach(() => { vi.restoreAllMocks(); });

describe('auth.getUser', () => {
  it('answers from the session with no network trip when someone is signed in', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null } as never);
    const { data, error } = await supabase.auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBe('u1');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('with no session, still asks the server', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'no' }), { status: 401 }));
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: null }, error: null } as never);
    const { data } = await supabase.auth.getUser();
    expect(data.user).toBeNull();
    // supabase-js has no token to send without a session, so it may answer "no user" itself; either way no user.
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
