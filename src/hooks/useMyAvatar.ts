import { useEffect, useState } from 'react';
import { supabase } from '../shared/supabase/client';
import { useAuth } from '../auth/AuthProvider';
import { onAvatarSaved } from '../stores/avatarEditorStore';
import type { AvatarConfigV2 } from '../types/avatar-v2';

// The signed-in person's own avatar, kept current when they edit it.
// null until loaded, or if they haven't made one yet.
export function useMyAvatar(): Partial<AvatarConfigV2> | null {
  const { user } = useAuth();
  const [config, setConfig] = useState<Partial<AvatarConfigV2> | null>(null);

  useEffect(() => {
    if (!user) { setConfig(null); return; }
    let cancelled = false;
    supabase.from('user_profiles').select('avatar_config').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setConfig((data?.avatar_config as Partial<AvatarConfigV2>) ?? null); });
    const off = onAvatarSaved(({ target, config: saved }) => { if (target.kind === 'user') setConfig(saved); });
    return () => { cancelled = true; off(); };
  }, [user]);

  return config;
}
