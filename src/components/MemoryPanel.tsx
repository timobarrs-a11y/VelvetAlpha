import { useState, useEffect, useCallback } from 'react';
import { Brain, Edit3, Trash2, Pin, PinOff, Search, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { memoryPanelService, MemoryItem } from '../services/memoryPanelService';
import { getCompanions } from '../services/companionService';
import { supabase } from '../shared/supabase/client';

const KIND_LABELS: Record<string, string> = {
  fact: 'Fact',
  preference: 'Preference',
  person: 'Person',
  thread: 'Thread',
  moment: 'Moment',
  boundary: 'Boundary',
  inside_joke: 'Inside Joke',
};

const KIND_COLORS: Record<string, string> = {
  fact: 'bg-blue-500/15 text-blue-300',
  preference: 'bg-emerald-500/15 text-emerald-300',
  person: 'bg-amber-500/15 text-amber-300',
  thread: 'bg-purple-500/15 text-purple-300',
  moment: 'bg-rose-500/15 text-rose-300',
  boundary: 'bg-red-500/15 text-red-300',
  inside_joke: 'bg-cyan-500/15 text-cyan-300',
};

const SCOPE_LABELS: Record<string, string> = {
  global: 'Shared',
  companion: 'This companion',
  private: 'Private',
};

interface CompanionInfo {
  id: string;
  name: string;
}

export function MemoryPanel() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companions, setCompanions] = useState<CompanionInfo[]>([]);
  const [selectedCompanionId, setSelectedCompanionId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editVersion, setEditVersion] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await memoryPanelService.list(selectedCompanionId || undefined);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanionId]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const comps = await getCompanions(user.id);
        const companionList = comps.map(c => ({ id: c.id, name: c.custom_name || c.name || 'Companion' }));
        setCompanions(companionList);
        if (companionList.length > 0 && !selectedCompanionId) {
          setSelectedCompanionId(companionList[0].id);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleEdit = async (item: MemoryItem) => {
    setActionLoading(item.id);
    try {
      await memoryPanelService.edit(item.id, editText, editVersion, selectedCompanionId || undefined);
      setEditingId(null);
      showToast('success', 'Memory updated');
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to edit';
      showToast('error', msg === 'Version conflict' ? 'This memory was updated elsewhere. Refreshed.' : msg);
      if (msg === 'Version conflict') await load();
    } finally {
      setActionLoading(null);
    }
  };

  const handleForget = async (item: MemoryItem) => {
    setActionLoading(item.id);
    try {
      await memoryPanelService.forget(item.id, selectedCompanionId || undefined);
      showToast('success', 'Memory forgotten');
      await load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to forget');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePin = async (item: MemoryItem) => {
    setActionLoading(item.id);
    try {
      await memoryPanelService.pin(item.id, item.importance < 10, selectedCompanionId || undefined);
      showToast('success', item.importance < 10 ? 'Pinned' : 'Unpinned');
      await load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to pin');
    } finally {
      setActionLoading(null);
    }
  };

  const startEdit = (item: MemoryItem) => {
    setEditingId(item.id);
    setEditText(item.content);
    setEditVersion(item.version);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const filtered = items.filter(item => {
    if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
    if (searchQuery && !item.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, MemoryItem[]>>((acc, item) => {
    const key = item.kind;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const kindOrder = ['fact', 'preference', 'person', 'thread', 'moment', 'inside_joke', 'boundary'];
  const sortedKinds = Object.keys(grouped).sort((a, b) => kindOrder.indexOf(a) - kindOrder.indexOf(b));

  return (
    <div className="rounded-xl p-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
          <Brain className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1">
          <p className="text-white font-medium">What I Remember</p>
          <p className="text-white/40 text-sm">See, edit, or forget what your companion has learned about you.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-white/40 hover:text-white/70 transition p-2"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Companion selector */}
      {companions.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCompanionId('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              !selectedCompanionId ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            All companions
          </button>
          {companions.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCompanionId(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                selectedCompanionId === c.id ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>
        <select
          value={kindFilter}
          onChange={e => setKindFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
        >
          <option value="all">All types</option>
          {kindOrder.map(k => (
            <option key={k} value={k}>{KIND_LABELS[k] ?? k}</option>
          ))}
        </select>
      </div>

      {toast && (
        <div className={`mb-3 p-2.5 rounded-lg text-sm flex items-center gap-2 ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.text}
        </div>
      )}

      {/* Content */}
      {error ? (
        <div className="py-8 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center">
          <Brain className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-sm">
            {items.length === 0 ? 'No memories yet. They will appear here as your companion learns about you.' : 'No memories match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5 max-h-[500px] overflow-y-auto pr-1">
          {sortedKinds.map(kind => (
            <div key={kind}>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                {KIND_LABELS[kind] ?? kind} ({grouped[kind].length})
              </p>
              <div className="space-y-2">
                {grouped[kind].map(item => (
                  <div
                    key={item.id}
                    className="rounded-lg p-3 border border-white/10 bg-white/[0.03] hover:border-white/20 transition group"
                  >
                    {editingId === item.id ? (
                      <div>
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          rows={3}
                          className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50 resize-none"
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleEdit(item)}
                            disabled={actionLoading === item.id || !editText.trim()}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition disabled:opacity-40"
                          >
                            {actionLoading === item.id ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1.5 rounded-lg text-xs text-white/50 border border-white/10 hover:bg-white/5 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-white/80 text-sm flex-1 leading-relaxed">{item.content}</p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                            <button
                              onClick={() => startEdit(item)}
                              disabled={actionLoading === item.id}
                              className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handlePin(item)}
                              disabled={actionLoading === item.id}
                              className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition"
                              title={item.importance >= 10 ? 'Unpin' : 'Pin'}
                            >
                              {item.importance >= 10 ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleForget(item)}
                              disabled={actionLoading === item.id}
                              className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition"
                              title="Forget this"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${KIND_COLORS[item.kind] ?? 'bg-white/10 text-white/50'}`}>
                            {KIND_LABELS[item.kind] ?? item.kind}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/40">
                            {SCOPE_LABELS[item.scope] ?? item.scope}
                          </span>
                          {item.importance >= 10 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 flex items-center gap-1">
                              <Pin className="w-2.5 h-2.5" /> Pinned
                            </span>
                          )}
                          {item.source === 'user_edited' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300">
                              Edited by you
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
