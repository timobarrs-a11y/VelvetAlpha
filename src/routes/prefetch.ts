/**
 * Getting a page's code before it's needed, so going there shows the page instead of a loading spinner. Each page is a
 * separate download the first time it's visited (the `lazy(() => import(...))` routes); calling the same import here
 * fetches and keeps that same file, so the route finds it ready.
 *
 * - `prefetchRoute(path)`: when a pointer or finger lands on a menu item, start that page's download.
 * - `prefetchCommon()`: once signed in and the browser is idle, the most-used pages, one at a time, skipped on a
 *   data-saver or slow connection.
 */

type Loader = () => Promise<unknown>;

// Menu destinations and the page files behind them (the same imports as src/routes).
const LOADERS: Record<string, Loader> = {
  // Not a page: the dock's chat and Messages windows, which load on demand (components/dock/Dock.tsx).
  '/_dock': () => Promise.all([import('../components/dock/AiChatWindow'), import('../components/MessagingOverlay'), import('../components/dock/FriendChatWindow')]),
  '/chat': () => import('../App'),
  '/spaces': () => import('../pages/HousePage'),
  '/atlas': () => import('../pages/AtlasPage'),
  '/goal': () => import('../pages/GoalDetailPage'),
  '/coaching-progress': () => import('../pages/CoachingProgressPage'),
  '/coaching-commitments': () => import('../pages/CoachingCommitmentsPage'),
  '/coaching-library': () => import('../pages/CoachingLibraryPage'),
  '/calendar': () => import('../pages/CalendarPage'),
  '/feed': () => import('../pages/ProgressFeedPage'),
  '/world': () => import('../pages/WorldPage'),
  '/daily-feed': () => import('../pages/DailyFeedPage'),
  '/videos': () => import('../pages/VideoHistoryPage'),
  '/co-author': () => import('../pages/CoAuthorPage'),
  '/insights': () => import('../pages/InsightsPage'),
  '/relationship-briefs': () => import('../pages/RelationshipBriefPage'),
  '/morning-journal': () => import('../pages/MorningJournalPage'),
  '/discover': () => import('../pages/DiscoverPage'),
  '/local-explorer': () => import('../pages/LocalExplorerPage'),
  '/group-chat': () => import('../pages/GroupChatPage'),
  '/real-or-not': () => import('../pages/RealOrNotPage'),
  '/settings': () => import('../pages/SettingsPage'),
  '/updates': () => import('../pages/ChangelogPage'),
  '/support': () => import('../pages/DonationPage'),
};

// The ones nearly everyone opens, in the order to fetch them while idle.
const COMMON = ['/_dock', '/chat', '/spaces', '/atlas', '/goal', '/coaching-commitments', '/calendar', '/feed', '/updates'];

const started = new Set<string>();

/** The loader for a path: its first segment (/goal/123 → /goal, /spaces/abc?tab=crews → /spaces). */
function loaderFor(path: string): [string, Loader] | null {
  const key = '/' + (path.split(/[?#]/)[0].split('/')[1] ?? '');
  return LOADERS[key] ? [key, LOADERS[key]] : null;
}

/** Start downloading a page's code (once). Failures are ignored: the route loads it again when visited. */
export function prefetchRoute(path: string): void {
  const hit = loaderFor(path);
  if (!hit || started.has(hit[0])) return;
  started.add(hit[0]);
  hit[1]().catch(() => { started.delete(hit[0]); });
}

function slowConnection(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType ?? ''));
}

const idle = (fn: () => void): void => {
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 3000 });
  else setTimeout(fn, 400);
};

let commonStarted = false;

/** Once per session: fetch the common pages one after another while the browser has nothing else to do. */
export function prefetchCommon(): void {
  if (commonStarted || slowConnection()) return;
  commonStarted = true;
  const queue = COMMON.slice();
  const next = (): void => {
    const path = queue.shift();
    if (!path) return;
    prefetchRoute(path);
    idle(next);
  };
  // Leave the page that's opening alone for a moment first.
  setTimeout(() => idle(next), 2500);
}
