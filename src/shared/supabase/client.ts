import { createClient, processLock } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// VITE_USE_SUPABASE_PROXY=true routes requests through the Vite server proxy
// (/supabase-proxy/*) to avoid WebContainer SSL cert interception issues.
// Set this to true in .env for local dev and Bolt-hosted preview deployments.
// Leave unset or false for real production deployments (Vercel, Netlify, etc.)
// where no proxy server runs.
const useProxy = import.meta.env.VITE_USE_SUPABASE_PROXY === 'true';
const clientUrl = useProxy
  ? `${window.location.origin}/supabase-proxy`
  : supabaseUrl;

export const supabase = createClient(clientUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The default lock is shared by every tab of the site through the browser's
    // Web Locks API, and data requests wait on it with no timeout. On mobile,
    // a frozen background tab can hold it forever: sign-in succeeds but nothing
    // else ever loads. A per-tab lock avoids that.
    lock: processLock,
  },
});

// auth.getUser() asks the auth server who is signed in, a network round trip (about 0.2s) every time, and the app calls
// it before most of its queries: on some pages two or three times in a row before anything loads. The signed-in user
// is already in the session this client keeps, so answer from that, and only ask the server when there's no session
// (or for a specific token). The database still checks the token on every request, so nothing is trusted that wasn't.
const serverGetUser = supabase.auth.getUser.bind(supabase.auth);
supabase.auth.getUser = (async (jwt?: string) => {
  if (jwt) return serverGetUser(jwt);
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return { data: { user: session.user }, error: null };
  return serverGetUser();
}) as typeof supabase.auth.getUser;
