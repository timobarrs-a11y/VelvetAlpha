import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../shared/supabase/client';
import { referralService } from '../services/referralService';
import { newsService } from '../services/newsService';

const NEWS_REFRESH_THROTTLE_KEY = 'velvet_news_last_refresh';

async function triggerNewsRefresh(_userId: string): Promise<void> {
  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem(NEWS_REFRESH_THROTTLE_KEY) || 0);
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    if (now - last < TWELVE_HOURS) return;
    sessionStorage.setItem(NEWS_REFRESH_THROTTLE_KEY, String(now));

    const interests = await newsService.getUserAllInterests();
    if (interests.length === 0) return;
    await newsService.fetchLatestNews(interests);
  } catch {
    /* best-effort refresh, never block login */
  }
}

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    async function init() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) console.error('[AuthProvider] getSession error:', error);
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      } catch (e) {
        console.error('[AuthProvider] getSession failed:', e);
      } finally {
        if (mounted) {
          clearTimeout(timeout);
          setLoading(false);
        }
      }
    }

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      if (newSession) {
        referralService.redeemPendingReferral().catch(() => {});
        triggerNewsRefresh(newSession.user.id).catch(() => {});
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, session, loading }),
    [user, session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider />');
  return ctx;
}
