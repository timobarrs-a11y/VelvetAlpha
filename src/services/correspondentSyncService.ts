import { supabase } from '../shared/supabase/client';

export interface SyncResult {
  success: boolean;
  desired: string[];
  created: string[];
  removed: string[];
  existing: string[];
}

class CorrespondentSyncService {
  /**
   * Calls the sync-correspondents edge function to auto-provision
   * and sync correspondents based on the user's current interests.
   */
  async sync(): Promise<SyncResult | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-correspondents`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        },
      );

      if (!response.ok) {
        console.error('[correspondentSync] sync failed:', response.status);
        return null;
      }

      const data = await response.json();
      return data as SyncResult;
    } catch (err) {
      console.error('[correspondentSync] sync error:', err);
      return null;
    }
  }
}

export const correspondentSyncService = new CorrespondentSyncService();
