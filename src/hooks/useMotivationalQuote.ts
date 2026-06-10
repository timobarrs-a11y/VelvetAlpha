import { useState, useEffect } from 'react';
import { supabase } from '../shared/supabase/client';
import { getQuoteForSession, MotivationalQuote, MOTIVATIONAL_QUOTES } from '../config/motivationalQuotes';

const STORAGE_KEY = 'velvet_daily_quote';

interface StoredQuote {
  userId: string;
  loginDate: string;
  quoteIndex: number;
}

export function useMotivationalQuote() {
  const [quote, setQuote] = useState<MotivationalQuote | null>(null);

  useEffect(() => {
    const resolve = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: { session } } = await supabase.auth.getSession();
      const loginDate = session?.user?.last_sign_in_at
        ? new Date(session.user.last_sign_in_at).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const stored: StoredQuote = JSON.parse(raw);
          if (stored.userId === user.id && stored.loginDate === loginDate) {
            setQuote(MOTIVATIONAL_QUOTES[stored.quoteIndex]);
            return;
          }
        }
      } catch {
        // ignore parse errors
      }

      const resolved = getQuoteForSession(user.id, loginDate);
      const index = MOTIVATIONAL_QUOTES.indexOf(resolved);

      try {
        const payload: StoredQuote = { userId: user.id, loginDate, quoteIndex: index };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // ignore storage errors
      }

      setQuote(resolved);
    };

    resolve();
  }, []);

  return quote;
}
