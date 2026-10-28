// Google Calendar: pinning a task to someone's own calendar. Everything here that doesn't touch the network is pure,
// so it is tested on its own (src/services/__tests__/googleCalendar.test.ts).

/** Add and change events on their calendars, plus which Google account it is (to show "connected as ..."). */
export const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'openid', 'email'];

export const DEFAULT_RETURN_PATH = '/coaching-commitments';
const STATE_LIFETIME_MS = 10 * 60 * 1000;

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text))));
}

/** Only a path inside the app, so a link can't send someone somewhere else after connecting. */
export function safeReturnPath(path: unknown): string {
  if (typeof path !== 'string') return DEFAULT_RETURN_PATH;
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.length > 200) return DEFAULT_RETURN_PATH;
  return path;
}

export interface CalendarState { userId: string; returnPath: string; exp: number }

/** What Google hands back after sign-in, so we know who it was for. Signed, so it can't be forged or reused later. */
export async function signState(userId: string, returnPath: string, secret: string, now = Date.now()): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ userId, returnPath: safeReturnPath(returnPath), exp: now + STATE_LIFETIME_MS })));
  return `${body}.${await hmac(secret, body)}`;
}

export async function verifyState(state: string, secret: string, now = Date.now()): Promise<CalendarState | null> {
  const [body, sig] = state.split('.');
  if (!body || !sig || (await hmac(secret, body)) !== sig) return null;
  try {
    const padded = body.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (body.length % 4)) % 4);
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0))));
    if (typeof parsed.userId !== 'string' || typeof parsed.exp !== 'number' || parsed.exp < now) return null;
    return { userId: parsed.userId, returnPath: safeReturnPath(parsed.returnPath), exp: parsed.exp };
  } catch {
    return null;
  }
}

export function buildAuthUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const q = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: CALENDAR_SCOPES.join(' '),
    // offline + consent so Google gives a refresh token every time, which is what lets us add events later.
    access_type: 'offline',
    prompt: 'consent',
    state: opts.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

export interface TaskForCalendar { id: string; description: string; due_date: string | null; companion_name?: string | null }

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** The day a task is due as YYYY-MM-DD: its own date, or today when it has none. */
export function eventDay(due: string | null | undefined, now = new Date()): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(due ?? '');
  return m ? m[1] : ymd(now);
}

/** An all-day event on the due day, tagged with the task so it can be found again. */
export function buildEvent(task: TaskForCalendar, goalTitle: string | null | undefined, link: string, now = new Date()) {
  const start = eventDay(task.due_date, now);
  const end = ymd(new Date(Date.parse(`${start}T00:00:00Z`) + 86_400_000));
  const by = task.companion_name && task.companion_name !== 'You' ? ` from ${task.companion_name}` : '';
  return {
    summary: clean(task.description).slice(0, 300),
    description: [`A task${by} on Velvet.`, goalTitle ? `Goal: ${clean(goalTitle)}` : '', link].filter(Boolean).join('\n'),
    start: { date: start },
    end: { date: end },
    extendedProperties: { private: { velvetTaskId: task.id } },
  };
}

/** Google says the refresh token no longer works (revoked, or a test-mode token past its week): they need to connect again. */
export function needsReconnect(status: number, body: string): boolean {
  if (status !== 400 && status !== 401) return false;
  return /invalid_grant|invalid_token|unauthorized_client/i.test(body);
}
