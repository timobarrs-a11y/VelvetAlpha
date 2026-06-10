import { BookOpen, CheckCircle2, Circle, X, Gem } from 'lucide-react';
import { QUESTS } from './islandData';

interface Props {
  questLog: Record<string, { progress: number; status: string }>;
  onClose: () => void;
}

export function QuestJournalModal({ questLog, onClose }: Props) {
  const activeQuests = QUESTS.filter(q => {
    const entry = questLog[q.id];
    return entry ? entry.status === 'active' : true;
  });

  const completedQuests = QUESTS.filter(q => {
    const entry = questLog[q.id];
    return entry?.status === 'completed';
  });

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-md mx-4">
        <div className="bg-gradient-to-b from-amber-950/95 to-slate-950/95 border border-amber-500/25 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-amber-500/15">
            <div className="flex items-center gap-3">
              <BookOpen className="text-amber-400" size={20} />
              <div>
                <h2 className="text-white font-bold leading-none">Quest Journal</h2>
                <p className="text-amber-400/50 text-xs mt-0.5">Your adventures in the Great Sea</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto">
            {activeQuests.length > 0 && (
              <div>
                <div className="text-amber-400/70 text-xs font-bold uppercase tracking-wider mb-2">Active Quests</div>
                <div className="space-y-2">
                  {activeQuests.map(quest => {
                    const entry = questLog[quest.id];
                    const progress = entry?.progress ?? 0;
                    const pct = Math.min(1, progress / quest.requiredProgress);
                    return (
                      <div key={quest.id} className="bg-white/5 border border-white/8 rounded-xl p-4">
                        <div className="flex items-start gap-2 mb-2">
                          <Circle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-white font-medium text-sm">{quest.title}</div>
                            <div className="text-white/50 text-xs mt-0.5 leading-relaxed">{quest.description}</div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white/30 text-[10px]">Progress</span>
                            <span className="text-white/50 text-[10px] font-mono">{progress}/{quest.requiredProgress}</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full transition-all"
                              style={{ width: `${pct * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-2 text-emerald-400/60 text-[10px]">
                          <Gem size={9} />
                          <span>Reward: {quest.rewardRupees} Rupees</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeQuests.length === 0 && completedQuests.length === 0 && (
              <div className="text-center py-8">
                <BookOpen className="mx-auto text-white/20 mb-3" size={32} />
                <p className="text-white/40 text-sm">No quests yet.</p>
                <p className="text-white/25 text-xs mt-1">Speak to NPCs on the islands to begin your adventure.</p>
              </div>
            )}

            {completedQuests.length > 0 && (
              <div>
                <div className="text-emerald-400/60 text-xs font-bold uppercase tracking-wider mb-2">Completed</div>
                <div className="space-y-2">
                  {completedQuests.map(quest => (
                    <div key={quest.id} className="bg-emerald-950/30 border border-emerald-500/15 rounded-xl p-3 flex items-center gap-3">
                      <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                      <div>
                        <div className="text-white/70 text-sm">{quest.title}</div>
                        <div className="text-emerald-400/50 text-xs">Completed</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
