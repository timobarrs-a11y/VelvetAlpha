import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Edit3, Filter, RefreshCw, Brain, AlertTriangle, Clock, Zap } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { PageHeader } from '../shared/ui';

interface MemoryProposal {
  id: string;
  proposal_id: string;
  pass: string;
  target: string;
  target_id: string;
  user_id: string | null;
  companion_id: string | null;
  action: string;
  before: string | null;
  after: string | null;
  evidence: string[] | Record<string, unknown>;
  prevalence: Record<string, unknown> | null;
  rationale: string | null;
  risk: string;
  base_version: number | null;
  eval_delta: Record<string, unknown> | null;
  status: string;
  applied_at: string | null;
  applied_by: string | null;
  created_at: string;
}

const RISK_COLORS: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-300',
  medium: 'bg-amber-500/15 text-amber-300',
  high: 'bg-red-500/15 text-red-300',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-500/15 text-blue-300',
  auto_applied: 'bg-emerald-500/15 text-emerald-300',
  approved: 'bg-emerald-500/15 text-emerald-300',
  rejected: 'bg-white/10 text-white/50',
  applied: 'bg-emerald-500/15 text-emerald-300',
  failed: 'bg-red-500/15 text-red-300',
};

const ACTION_COLORS: Record<string, string> = {
  supersede: 'bg-purple-500/15 text-purple-300',
  retire: 'bg-gray-500/15 text-gray-300',
  merge: 'bg-cyan-500/15 text-cyan-300',
  edit: 'bg-blue-500/15 text-blue-300',
  add: 'bg-green-500/15 text-green-300',
};

const ADMIN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-proposals-admin`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

export function MemoryProposalsPage() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<MemoryProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [passFilter, setPassFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
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
      const headers = await getAuthHeaders();
      const body: Record<string, string> = { action: 'list' };
      if (statusFilter) body.status = statusFilter;
      if (passFilter) body.pass = passFilter;
      if (riskFilter) body.risk = riskFilter;

      const res = await fetch(ADMIN_URL, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      setProposals(data.proposals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, passFilter, riskFilter]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (p: MemoryProposal) => {
    setActionLoading(p.id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(ADMIN_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'approve', proposalId: p.id, editedAfter: editingId === p.id ? editText : undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Approve failed (${res.status})`);
      }
      showToast('success', 'Proposal approved and applied');
      setEditingId(null);
      await load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (p: MemoryProposal) => {
    setActionLoading(p.id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(ADMIN_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'reject', proposalId: p.id }),
      });
      if (!res.ok) throw new Error(`Reject failed (${res.status})`);
      showToast('success', 'Proposal rejected');
      await load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const startEdit = (p: MemoryProposal) => {
    setEditingId(p.id);
    setEditText(p.after || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const evidenceArray = (p: MemoryProposal): string[] => {
    if (Array.isArray(p.evidence)) return p.evidence as string[];
    return [];
  };

  return (
    <div className="ds-page">
      <PageHeader
        title="Memory Proposals"
        subtitle="Review and approve dreaming pass proposals"
        icon={Brain}
        accent="#c084fc"
        width="lg"
        back={() => navigate(-1)}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <div className="flex items-center gap-2 text-white/50 text-sm">
            <Filter className="w-4 h-4" />
            <span>Filter:</span>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="auto_applied">Auto-applied</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={passFilter}
            onChange={e => setPassFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
          >
            <option value="">All passes</option>
            <option value="hygiene">Hygiene (Pass A)</option>
            <option value="fleet">Fleet (Pass B)</option>
          </select>
          <select
            value={riskFilter}
            onChange={e => setRiskFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
          >
            <option value="">All risk levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="text-white/40 hover:text-white/70 transition p-2"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {toast && (
          <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.text}
          </div>
        )}

        {error ? (
          <div className="py-12 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-400">{error}</p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : proposals.length === 0 ? (
          <div className="py-12 text-center">
            <Brain className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">No proposals match your filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map(p => (
              <div
                key={p.id}
                className="rounded-xl p-5 border border-white/10 bg-white/[0.03] hover:border-white/20 transition"
              >
                {/* Header badges */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${RISK_COLORS[p.risk] ?? 'bg-white/10 text-white/50'}`}>
                    {p.risk} risk
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.status] ?? 'bg-white/10 text-white/50'}`}>
                    {p.status}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[p.action] ?? 'bg-white/10 text-white/50'}`}>
                    {p.action}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-white/40">
                    {p.pass}
                  </span>
                  <span className="text-white/30 text-xs flex items-center gap-1 ml-auto">
                    <Clock className="w-3 h-3" />
                    {new Date(p.created_at).toLocaleString()}
                  </span>
                </div>

                {/* Before/After diff */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="rounded-lg p-3 bg-red-500/[0.05] border border-red-500/10">
                    <p className="text-red-300/60 text-xs font-medium mb-1">BEFORE</p>
                    <p className="text-white/70 text-sm leading-relaxed">{p.before || '(empty)'}</p>
                  </div>
                  {editingId === p.id ? (
                    <div className="rounded-lg p-3 bg-emerald-500/[0.05] border border-emerald-500/20">
                      <p className="text-emerald-300/60 text-xs font-medium mb-1">AFTER (editing)</p>
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={3}
                        className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleApprove(p)}
                          disabled={actionLoading === p.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40"
                        >
                          {actionLoading === p.id ? 'Applying...' : 'Save & Approve'}
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
                    <div className="rounded-lg p-3 bg-emerald-500/[0.05] border border-emerald-500/10">
                      <p className="text-emerald-300/60 text-xs font-medium mb-1">AFTER</p>
                      <p className="text-white/70 text-sm leading-relaxed">{p.after || '(empty — retire/delete)'}</p>
                    </div>
                  )}
                </div>

                {/* Rationale */}
                {p.rationale && (
                  <p className="text-white/50 text-sm mb-3 italic">{p.rationale}</p>
                )}

                {/* Evidence */}
                {evidenceArray(p).length > 0 && (
                  <div className="mb-3">
                    <p className="text-white/40 text-xs mb-1">Evidence:</p>
                    <div className="flex flex-wrap gap-1">
                      {evidenceArray(p).map((ev, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-xs bg-white/5 text-white/40 font-mono">
                          {ev.length > 40 ? ev.substring(0, 40) + '...' : ev}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Eval delta */}
                {p.eval_delta && Object.keys(p.eval_delta).length > 0 && (
                  <div className="mb-3 flex items-center gap-2 text-xs">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="text-white/40">Eval delta:</span>
                    <span className="text-white/60 font-mono">{JSON.stringify(p.eval_delta)}</span>
                  </div>
                )}

                {/* Actions */}
                {p.status === 'pending' && editingId !== p.id && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleApprove(p)}
                      disabled={actionLoading === p.id}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      {actionLoading === p.id ? 'Applying...' : 'Approve & Apply'}
                    </button>
                    <button
                      onClick={() => startEdit(p)}
                      disabled={actionLoading === p.id}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-blue-400 border border-blue-500/20 hover:bg-blue-500/10 transition disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleReject(p)}
                      disabled={actionLoading === p.id}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
