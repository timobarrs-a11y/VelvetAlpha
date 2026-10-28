import { supabase } from '../shared/supabase/client';
import { migrateAvatarConfig } from '../utils/avatarConfig';
import type { AvatarConfigV2 } from '../types/avatar-v2';

// The server is the final authority on what a saved avatar may wear.
// sanitizeAvatarConfig() checks the caller's membership, medals, and owned
// avatar_inventory items, and returns the config with any locked wardrobe
// or hair items replaced by their starter fallbacks. The saved look itself
// is preserved when the caller is entitled, so re-earning an item restores it.
//
// Returns a migrated, server-sanitized config. On any error or when there is
// no signed-in user, falls back to the client-side migrated config so a
// network blip never blocks saving entirely — the DB still owns the truth on
// a successful write, and a failed sanitize simply means we did not get to
// re-check entitlements this time.
//
// A companion's look is checked against that companion: the attire its signature voice comes dressed in is theirs
// to wear whatever the owner's membership (see config/voiceAttire.ts), so it goes to sanitize_companion_avatar_config.
export async function sanitizeAvatarConfigForSave(
  config: Partial<AvatarConfigV2>,
  companionId?: string,
): Promise<AvatarConfigV2> {
  const migrated = migrateAvatarConfig(config);

  try {
    const { data, error } = companionId
      ? await supabase.rpc('sanitize_companion_avatar_config', {
          p_config: migrated as unknown as Record<string, unknown>,
          p_companion_id: companionId,
        })
      : await supabase.rpc('sanitize_avatar_config', {
          p_config: migrated as unknown as Record<string, unknown>,
        });

    if (error) return migrated;
    if (!data) return migrated;
    return migrateAvatarConfig(data as Partial<AvatarConfigV2>);
  } catch {
    return migrated;
  }
}
