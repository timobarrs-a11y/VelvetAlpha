import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AWAY_MS, alreadyThere, resumePoint, resumeRoute, snoozesLeft, type ResumePoint } from './resumeStage';
import { latestAtlasConversation, loadResumeFacts, requestPickup, snoozesAllowed } from './resumeService';

/**
 * Takes someone back to where they left off: at sign-in (the first page of a visit), before that page shows, and again
 * when they come back after 30+ minutes away. The page they were heading to waits behind a short "picking up" screen;
 * then they land where they stopped, with a pickup message waiting in the conversation (resume-pickup). A bar there
 * offers "Not now" (as many a day as app_settings.resume_gate_snooze_per_day allows, 1 by default; 0 makes the
 * pickup absolute) and, for a goal with no plan, the hand-off to the coach.
 */
const LAST_SEEN = (uid: string) => `velvet.lastSeen:${uid}`;
const SNOOZE = (uid: string) => `velvet.resumeSnooze:${uid}`;
const today = () => new Date().toLocaleDateString('en-CA');
const read = <T,>(key: string): T | null => { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked */ } };

const SIGNED_IN = 'velvet.justSignedIn';
/** The login page calls this, so the first page after signing in is checked even if they were here a minute ago. */
export function markSignedIn(): void { try { sessionStorage.setItem(SIGNED_IN, '1'); } catch { /* storage blocked */ } }
/** Whether opening the app now counts as coming back: a sign-in, or 30+ minutes since they were last here. */
function freshVisit(uid: string): boolean {
  let signedIn = false;
  try { signedIn = sessionStorage.getItem(SIGNED_IN) === '1'; sessionStorage.removeItem(SIGNED_IN); } catch { /* storage blocked */ }
  const last = read<number>(LAST_SEEN(uid));
  return signedIn || !last || Date.now() - last >= AWAY_MS;
}

/** Checked once per visit (a module, so it survives page changes); `running` keeps two checks from overlapping. */
let checkedFor: string | null = null;
let running = false;
/** The pickup that just happened, for the bar on the page it landed on. */
let landed: { point: ResumePoint; route: string; from: string; snoozable: boolean } | null = null;

export function ResumeGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const navigate = useNavigate();
  const location = useLocation();
  const [holding, setHolding] = useState(() => !!uid && checkedFor !== uid);
  const [, rerender] = useState(0);
  const here = useRef(location);
  here.current = location;

  async function check(blocking: boolean): Promise<void> {
    if (!uid || running) return;
    running = true;
    if (blocking) setHolding(true);
    try {
      const [allowed, facts] = await Promise.all([snoozesAllowed(), loadResumeFacts(uid)]);
      // "Not now" is a way out for a quick visit, not an off switch: once today's are used, the pickup has none.
      const left = snoozesLeft(read<{ day: string; used: number }>(SNOOZE(uid)), allowed, today());
      const point = resumePoint(facts);
      const loc = here.current;
      if (!point || alreadyThere(point, loc.pathname, loc.search)) return;
      // The pickup is written before they land, so it is there when the page loads. It never holds them up for long.
      const pickup = await Promise.race([requestPickup(point), new Promise<null>((r) => setTimeout(() => r(null), 9000))]);
      const conversation = pickup?.conversationId ?? (point.stage === 'no_goal' || point.stage === 'goal_no_plan' ? await latestAtlasConversation(uid) : null);
      const route = resumeRoute(point, conversation);
      landed = { point, route, from: loc.pathname + loc.search, snoozable: left > 0 };
      navigate(route, { replace: true });
    } catch (err) {
      console.error('[resume] check failed:', err);
    } finally {
      running = false;
      checkedFor = uid;
      setHolding(false);
    }
  }

  // The first page of a visit (a sign-in, or opening the app after 30+ minutes away): check before it shows. A reload a
  // few minutes in is not a visit, so it never bounces anyone.
  useEffect(() => {
    if (uid && checkedFor !== uid) {
      if (freshVisit(uid)) void check(true);
      else { checkedFor = uid; setHolding(false); }
    } else setHolding(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Coming back after 30+ minutes away (this tab, or the app closed and opened again within the visit).
  useEffect(() => {
    if (!uid) return;
    const seen = () => write(LAST_SEEN(uid), Date.now());
    const onVisible = () => {
      if (document.visibilityState === 'hidden') { seen(); return; }
      const last = read<number>(LAST_SEEN(uid));
      if (last && Date.now() - last >= AWAY_MS) { landed = null; void check(false); }
      seen();
    };
    seen();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', seen);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('pagehide', seen); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  if (holding) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--shell-bg, #0b0a10)' }}>
        <p className="text-sm" style={{ color: 'var(--shell-text-muted, #a9a1ae)' }}>Picking up where you left off…</p>
      </div>
    );
  }

  const bar = landed && alreadyThere(landed.point, location.pathname, location.search) ? landed : null;
  const notNow = () => {
    if (!uid || !bar) return;
    const stored = read<{ day: string; used: number }>(SNOOZE(uid));
    write(SNOOZE(uid), { day: today(), used: (stored?.day === today() ? stored.used : 0) + 1 });
    const from = bar.from;
    landed = null;
    rerender((n) => n + 1);
    navigate(from, { replace: true });
  };
  const handOff = async () => {
    if (!bar?.point.coachId) return;
    const point = bar.point;
    landed = null;
    rerender((n) => n + 1);
    await requestPickup(point, true);
    navigate(`/chat?companion=${point.coachId}`);
  };

  return (
    <>
      {children}
      {bar && (bar.snoozable || (bar.point.stage === 'goal_no_plan' && bar.point.coachId)) && (
        <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-lg"
            style={{ background: 'var(--shell-surface, #17151d)', border: '1px solid var(--shell-border-strong, rgba(255,255,255,.14))', color: 'var(--shell-text-primary, #f2eee8)' }}>
            <span>Picked up where you left off.</span>
            {bar.point.stage === 'goal_no_plan' && bar.point.coachId && (
              <button type="button" onClick={handOff} className="rounded-full px-3 py-1 font-semibold" style={{ background: 'var(--shell-accent, #e0a43a)', color: '#241b25' }}>
                Build the plan with your coach
              </button>
            )}
            {bar.snoozable && (
              <button type="button" onClick={notNow} className="rounded-full px-3 py-1" style={{ color: 'var(--shell-text-muted, #a9a1ae)' }}>
                Not now
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
