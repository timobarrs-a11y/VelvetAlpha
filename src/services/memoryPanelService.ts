import { supabase } from '../shared/supabase/client';

const MEMORY_MUTATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-mutate`;

export interface MemoryItem {
  id: string;
  content: string;
  kind: string;
  scope: string;
  status: string;
  importance: number;
  source: string;
  version: number;
  companion_id: string | null;
  created_at: string;
  updated_at: string;
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

class MemoryPanelService {
  async list(companionId?: string): Promise<MemoryItem[]> {
    const headers = await getAuthHeaders();
    const res = await fetch(MEMORY_MUTATE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'list', companionId }),
    });
    if (!res.ok) throw new Error(`Failed to load memories (${res.status})`);
    const data = await res.json();
    return data.items ?? [];
  }

  async edit(id: string, content: string, baseVersion: number, companionId?: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(MEMORY_MUTATE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'edit', id, content, baseVersion, companionId }),
    });
    if (res.status === 409) throw new Error('Version conflict');
    if (!res.ok) throw new Error(`Edit failed (${res.status})`);
  }

  async forget(id: string, companionId?: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(MEMORY_MUTATE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'forget', id, companionId }),
    });
    if (!res.ok) throw new Error(`Forget failed (${res.status})`);
  }

  async pin(id: string, pinned: boolean, companionId?: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(MEMORY_MUTATE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'pin', id, pinned, companionId }),
    });
    if (!res.ok) throw new Error(`Pin failed (${res.status})`);
  }
}

export const memoryPanelService = new MemoryPanelService();
