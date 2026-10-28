import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Check, Circle, AlertTriangle, Undo2, X } from 'lucide-react';
import { supabase } from '../../shared/supabase/client';
import {
  getPlans,
  updatePlanStepStatus,
  updatePlanStepTitle,
  respondToPlan,
  planProgressPercent,
  type CoachPlan,
  type CoachPlanStep,
} from '../../services/coachingService';

interface Props {
  userId: string;
  companionId?: string | null;
  highlightIds?: string[];
  onBack: () => void;
  /** Walk them through a plan they never said yes to (they were brought back here to accept it: features/resume). */
  walkthrough?: boolean;
}

/** The plan walkthrough, a step at a time, above a plan that is waiting for a yes. */
const WALKTHROUGH = [
  { title: 'This is your plan', body: 'Your coach drafted it from what you told them: the steps, in order, toward your goal.' },
  { title: 'Make it yours', body: 'Read the steps through. Anything that does not fit, say so to your coach in the chat and it changes.' },
  { title: 'Say yes to start', body: 'Tap **Let\'s go** and the first commitments go on your calendar. **Not for me** starts it over with your coach.' },
];

function PlanWalkthroughStrip({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = WALKTHROUGH[step];
  const last = step === WALKTHROUGH.length - 1;
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4" role="region" aria-label="Plan walkthrough">
      <div className="mb-2 flex gap-1.5">
        {WALKTHROUGH.map((_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-emerald-500' : 'bg-emerald-100'}`} />)}
      </div>
      <p className="text-sm font-semibold text-gray-900">{s.title}</p>
      <p className="mt-1 text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: s.body.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') }} />
      <div className="mt-3 flex gap-2">
        <button onClick={() => (last ? onDone() : setStep(step + 1))} className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">
          {last ? 'Got it' : 'Next'}
        </button>
        {!last && <button onClick={onDone} className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-white">Skip the tour</button>}
      </div>
    </div>
  );
}

export function PlanTab({ userId, companionId, highlightIds, onBack, walkthrough }: Props) {
  const [touring, setTouring] = useState(!!walkthrough);
  const [plans, setPlans] = useState<CoachPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [belowFloorStep, setBelowFloorStep] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<{ stepId: string; prevStatus: string; label: string } | null>(null);

  const load = useCallback(async () => {
    const data = await getPlans(userId, companionId);
    setPlans(data);
    setLoading(false);
  }, [userId, companionId]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('plan-tab-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_plan_steps' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_plans' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coaching_commitments' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_goals' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const handleToggleStep = async (step: CoachPlanStep) => {
    const newStatus = step.status === 'completed' ? 'pending' : 'completed';
    setUndoAction({ stepId: step.id, prevStatus: step.status, label: step.title });
    try {
      await updatePlanStepStatus(step.id, newStatus);
    } catch {
      setUndoAction(null);
    }
  };

  const handleUndo = async () => {
    if (!undoAction) return;
    try {
      await updatePlanStepStatus(undoAction.stepId, undoAction.prevStatus as CoachPlanStep['status']);
    } catch { /* best-effort */ }
    setUndoAction(null);
  };

  const handleSaveEdit = async (stepId: string) => {
    if (!editValue.trim()) { setEditingStep(null); return; }
    try {
      const result = await updatePlanStepTitle(stepId, editValue.trim());
      if (result.is_below_floor) {
        setBelowFloorStep(stepId);
      }
    } catch { /* error shown by toast */ }
    setEditingStep(null);
    setEditValue('');
  };

  const handleAcceptPlan = async (plan: CoachPlan) => {
    await respondToPlan(userId, { id: plan.id, title: plan.title, companion_id: plan.companion_id }, true);
  };

  const handleDeclinePlan = async (plan: CoachPlan) => {
    await respondToPlan(userId, { id: plan.id, title: plan.title, companion_id: plan.companion_id }, false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/80">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-200/60 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-base font-semibold text-gray-900">Plan</h2>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {touring && plans.some(p => p.status === 'proposed') && <PlanWalkthroughStrip onDone={() => setTouring(false)} />}
        {plans.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">No plans yet. Your coach will create one in your next conversation.</p>
          </div>
        )}

        {plans.map(plan => {
          const pct = planProgressPercent(plan);
          const isProposed = plan.status === 'proposed';
          const isHighlighted = highlightIds?.includes(plan.id);
          return (
            <motion.div
              key={plan.id}
              initial={isHighlighted ? { boxShadow: '0 0 0 2px rgba(16,185,129,0.4)' } : false}
              animate={isHighlighted ? { boxShadow: '0 0 0 0px rgba(16,185,129,0)' } : {}}
              transition={{ duration: 2 }}
              className={`bg-white rounded-2xl border border-gray-200/80 overflow-hidden ${isProposed ? 'ring-2 ring-emerald-200' : ''}`}
            >
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{plan.title}</h3>
                    {plan.cadence && <p className="text-xs text-gray-400 mt-0.5">{plan.cadence}</p>}
                    {plan.description && <p className="text-xs text-gray-500 mt-1">{plan.description}</p>}
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${
                    plan.status === 'active' ? 'bg-emerald-50 text-emerald-600'
                    : plan.status === 'proposed' ? 'bg-amber-50 text-amber-600'
                    : plan.status === 'completed' ? 'bg-blue-50 text-blue-600'
                    : 'bg-gray-100 text-gray-500'
                  }`}>
                    {plan.status}
                  </span>
                </div>
                {plan.steps && plan.steps.length > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-emerald-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{pct}% complete</p>
                  </div>
                )}
              </div>

              {plan.steps && plan.steps.length > 0 && (
                <div className="divide-y divide-gray-50">
                  {plan.steps.map((step) => {
                    const isDone = step.status === 'completed';
                    const isSkipped = step.status === 'skipped';
                    const isHighlightedStep = highlightIds?.includes(step.id);
                    const isBelowFloor = belowFloorStep === step.id || step.is_below_floor;
                    return (
                      <motion.div
                        key={step.id}
                        initial={isHighlightedStep ? { backgroundColor: 'rgba(16,185,129,0.08)' } : false}
                        animate={isHighlightedStep ? { backgroundColor: 'rgba(16,185,129,0)' } : {}}
                        transition={{ duration: 2 }}
                        className="flex items-start gap-3 px-5 py-3"
                      >
                        <button
                          onClick={() => !isSkipped && handleToggleStep(step)}
                          disabled={isSkipped || isProposed}
                          className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110 disabled:opacity-30"
                        >
                          {isDone ? (
                            <Check className="w-5 h-5 text-emerald-500" />
                          ) : isSkipped ? (
                            <X className="w-5 h-5 text-gray-300" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-300 hover:text-emerald-400" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          {editingStep === step.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveEdit(step.id);
                                  if (e.key === 'Escape') { setEditingStep(null); setEditValue(''); }
                                }}
                                className="text-sm flex-1 border border-emerald-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                              />
                              <button onClick={() => handleSaveEdit(step.id)} className="text-xs font-semibold text-emerald-600">Save</button>
                            </div>
                          ) : (
                            <p
                              className={`text-sm ${isDone ? 'text-gray-400 line-through' : 'text-gray-700'} ${!isProposed ? 'cursor-text hover:bg-gray-50 rounded px-1 -mx-1' : ''}`}
                              onClick={() => {
                                if (!isProposed && !isDone && !isSkipped) {
                                  setEditingStep(step.id);
                                  setEditValue(step.user_set_title || step.title);
                                }
                              }}
                            >
                              {step.user_set_title || step.title}
                            </p>
                          )}
                          {isBelowFloor && (
                            <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Below coach's minimum
                              {step.coach_minimum && ` (${step.coach_minimum})`}
                            </p>
                          )}
                          {step.coach_minimum && !isBelowFloor && (
                            <p className="text-[10px] text-gray-300 mt-0.5">Minimum: {step.coach_minimum}</p>
                          )}
                        </div>
                        {step.user_set_title && step.coach_proposed_title && step.user_set_title !== step.coach_proposed_title && (
                          <span className="text-[10px] text-gray-300 italic">edited</span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {isProposed && (
                <div className="px-5 py-3 bg-amber-50/50 border-t border-amber-100 flex items-center gap-2">
                  <button
                    onClick={() => handleAcceptPlan(plan)}
                    className="px-4 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition-colors"
                  >
                    Let's go
                  </button>
                  <button
                    onClick={() => handleDeclinePlan(plan)}
                    className="px-4 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Not for me
                  </button>
                </div>
              )}
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
              <button onClick={handleUndo} className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
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
