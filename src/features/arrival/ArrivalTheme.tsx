import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../../shared/supabase/client';
import { accentVars } from './arrivalUtils';

/**
 * Wraps a shell page so its accent is the user's favorite color instead of the
 * shell's own (Atlas's gold): from the moment they pick it, the arrival is theirs.
 */
export function ArrivalTheme({ children, color }: { children: ReactNode; color?: string | null }) {
  const [favorite, setFavorite] = useState<string | null>(color ?? null);

  useEffect(() => {
    if (color !== undefined) {
      setFavorite(color);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase.from('user_profiles').select('favorite_color').eq('id', user.id).maybeSingle();
      if (!cancelled) setFavorite(data?.favorite_color ?? null);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [color]);

  return <div style={accentVars(favorite) as CSSProperties}>{children}</div>;
}
