import { createClient } from '@supabase/supabase-js';

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
  },
});
