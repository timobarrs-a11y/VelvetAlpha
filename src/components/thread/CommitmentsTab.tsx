import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Check, Circle, Undo2, X, Calendar, Plus, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../shared/supabase/client';
import {
  getCommitments,
  updateCommitmentStatus,
  commitmentDueLabel,
  commitmentStatusColor,
  type CoachingCommitment,
  type CommitmentStatus,
} from '../../services/coachingService';
import { toggleCommitmentShowOnProfile } from '../../services/publicProfileService';

interface Props {
  userId: string;
  companionId?: string | null;
  highlightIds?: string[];
  onBack: () => void;
}

const STATUS_FILTERS = ['pending', 'completed', 'missed'] as const;

export function CommitmentsTab({ userId, companionId, highlightIds, onBack }: Props) {
  const [commitments, setCommitments] = useState<CoachingCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<typeof STATUS_FILTERS[number]>('pending');
  const [undoAction, setUndoAction] = useState<{ id: string; prevStatus: string; label: string } | null>(null);

  const load = useCallback(async () => {
    const data = await getCommitments(userId, companionId);
    setCommitments(data);
    setLoading(false);
  }, [userId, companionId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('commitments-tab-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coaching_commitments' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const handleToggle = async (commitment: CoachingCommitment) => {
    const newStatus: CommitmentStatus = commitment.status === 'completed' ? 'pending' : 'completed';
    setUndoAction({ id: commitment.id, prevStatus: commitment.status, label: commitment.description });
    try {
      await updateCommitmentStatus(commitment.id, newStatus);
    } catch {
      setUndoAction(null);
    }
  };

  const handleUndo = async () => {
    if (!undoAction) return;
    try {
      await updateCommitmentStatus(undoAction.id, undoAction.prevStatus as CommitmentStatus);
    } catch { /* best-effort */ }
    setUndoAction(null);
  };

  const handleToggleProfile = async (commitment: CoachingCommitment) => {
    const next = !commitment.show_on_profile;
    setCommitments(prev => prev.map(c => c.id === commitment.id ? { ...c, show_on_profile: next } : c));
    try {
      await toggleCommitmentShowOnProfile(commitment.id, next);
    } catch {
      setCommitments(prev => prev.map(c => c.id === commitment.id ? { ...c, show_on_profile: !next } : c));
    }
  };

  const filtered = commitments.filter(c => {
    if (activeFilter === 'pending') return c.status === 'pending' || c.status === 'in_progress';
    if (activeFilter === 'completed') return c.status === 'completed';
    if (activeFilter === 'missed') return c.status === 'missed';
    return true;
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/80">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-200/60 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-base font-semibold text-gray-900">Commitments</h2>
        <div className="ml-auto flex items-center gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full transition-colors ${
                activeFilter === f
                  ? f === 'pending' ? 'bg-amber-100 text-amber-700'
                  : f === 'completed' ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
                  : 'text-gray-400 hover:bg-gray-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">
              {activeFilter === 'pending' ? 'No open commitments. Your coach will set some in your next conversation.' : `No ${activeFilter} commitments.`}
            </p>
          </div>
        )}

        {filtered.map(commitment => {
          const isDone = commitment.status === 'completed';
          const isMissed = commitment.status === 'missed';
          const isHighlighted = highlightIds?.includes(commitment.id);
          return (
            <motion.div
              key={commitment.id}
              initial={isHighlighted ? { boxShadow: '0 0 0 2px rgba(245,158,11,0.4)' } : false}
              animate={isHighlighted ? { boxShadow: '0 0 0 0px rgba(245,158,11,0)' } : {}}
              transition={{ duration: 2 }}
              className="bg-white rounded-xl border border-gray-200/80 px-4 py-3 flex items-start gap-3"
            >
              <button
                onClick={() => handleToggle(commitment)}
                disabled={isMissed}
                className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110 disabled:opacity-30"
              >
                {isDone ? (
                  <Check className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-300 hover:text-amber-400" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${isDone ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {commitment.description}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {commitment.due_date && (
                    <span className={`text-[10px] flex items-center gap-1 ${isMissed ? 'text-red-500' : 'text-gray-400'}`}>
                      <Calendar className="w-3 h-3" /> {commitmentDueLabel(commitment.due_date)}
                    </span>
                  )}
                  {commitment.companion_name && (
                    <span className="text-[10px] text-gray-300">by {commitment.companion_name}</span>
                  )}
                  {isMissed && (
                    <span className="text-[10px] font-semibold text-red-500 uppercase">missed</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleToggleProfile(commitment)}
                  className={`p-1 rounded-lg transition-colors ${
                    commitment.show_on_profile
                      ? 'text-amber-600 hover:bg-amber-50'
                      : 'text-gray-300 hover:bg-gray-100 hover:text-gray-400'
                  }`}
                  title={commitment.show_on_profile ? 'Visible on your public profile' : 'Hidden from your public profile'}
                >
                  {commitment.show_on_profile ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <div
                  className="w-1 h-10 rounded-full"
                  style={{ background: commitmentStatusColor(commitment.status) }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {undoAction && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gray-900/90 backdrop-blur-sm text-white shadow-lg">
              <span className="text-xs">Updated "{undoAction.label}"</span>
              <button onClick={handleUndo} className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300">
                <Undo2 className="w-3 h-3" /> Undo
              </button>
              <button onClick={() => setUndoAction(null)} className="text-gray-400 hover:text-gray-200">
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
