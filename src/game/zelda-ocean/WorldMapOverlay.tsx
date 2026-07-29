import { Map, Anchor, Lock, CheckCircle2, X, Skull } from 'lucide-react';
import { ISLANDS } from './islandData';
import type { IslandDef } from './rpgTypes';
import type { RPGSave, IslandProgress } from './rpgTypes';

interface Props {
  save: RPGSave;
  islandProgress: IslandProgress[];
  onIslandSelect: (island: IslandDef) => void;
  onClose: () => void;
}

export function WorldMapOverlay({ save, islandProgress, onIslandSelect, onClose }: Props) {
  const progressMap = new Map(islandProgress.map(p => [p.islandId, p]));

  function isUnlocked(island: IslandDef): boolean {
    if (!island.requiredItem) return true;
    if (island.requiredItem === 'sword' && !save.hasSword) return false;
    if (island.requiredItem === 'shield' && !save.hasShield) return false;
    if (island.requiredItem === 'hookshot' && !save.hasHookshot) return false;
    if (island.requiredItem === 'bow' && !save.hasBow) return false;
    if (island.requiredDungeon) {
      const dep = progressMap.get(island.requiredDungeon);
      if (!dep?.dungeonCleared) return false;
    }
    return true;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-2xl mx-4 relative">
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-sky-500/30 rounded-2xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Map className="text-sky-400" size={22} />
              <div>
                <h2 className="text-white font-bold text-lg leading-none">The Great Sea</h2>
                <p className="text-sky-400/60 text-xs mt-0.5">Select an island to sail toward</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="relative p-6" style={{ height: 340 }}>
            <div className="absolute inset-6 rounded-xl overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(ellipse at 50% 60%, #0d5e8a 0%, #083a55 40%, #051e30 100%)',
                }}
              />
              {Array.from({ length: 18 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full opacity-20 animate-pulse"
                  style={{
                    width: 4 + (i % 3) * 3,
                    height: 4 + (i % 3) * 3,
                    left: `${(Math.sin(i * 2.3) * 0.5 + 0.5) * 90 + 5}%`,
                    top: `${(Math.cos(i * 1.7) * 0.5 + 0.5) * 80 + 10}%`,
                    background: '#9ad8f0',
                    animationDelay: `${i * 0.3}s`,
                  }}
                />
              ))}

              {ISLANDS.map(island => {
                const progress = progressMap.get(island.id);
                const unlocked = isUnlocked(island);
                const discovered = save.discoveredIslands.includes(island.id);
                const cleared = progress?.dungeonCleared ?? false;

                return (
                  <button
                    key={island.id}
                    onClick={() => unlocked && onIslandSelect(island)}
                    disabled={!unlocked}
                    className="absolute group transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200"
                    style={{ left: `${island.worldX}%`, top: `${island.worldY}%` }}
                    title={island.name}
                  >
                    <div
                      className={`relative flex flex-col items-center gap-1 ${unlocked ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200
                          ${unlocked ? 'group-hover:scale-110 shadow-lg' : ''}
                          ${cleared ? 'border-emerald-400 shadow-emerald-500/30' : unlocked ? 'border-sky-400 shadow-sky-500/30' : 'border-slate-600'}
                        `}
                        style={{ background: island.color }}
                      >
                        {!unlocked ? (
                          <Lock size={14} className="text-slate-300" />
                        ) : cleared ? (
                          <CheckCircle2 size={14} className="text-emerald-200" />
                        ) : discovered ? (
                          <Anchor size={14} className="text-white" />
                        ) : (
                          <span className="text-white text-xs font-bold">?</span>
                        )}
                      </div>

                      {(discovered || unlocked) && (
                        <span
                          className={`text-xs font-bold whitespace-nowrap drop-shadow
                            ${cleared ? 'text-emerald-300' : unlocked ? 'text-white' : 'text-slate-400'}
                          `}
                          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
                        >
                          {island.name}
                        </span>
                      )}

                      {cleared && (
                        <span className="text-emerald-400 text-[9px] font-mono">CLEARED</span>
                      )}
                      {!unlocked && island.requiredItem && (
                        <span className="text-slate-400 text-[9px] font-mono">
                          need {island.requiredItem}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-6 pb-5">
            <div className="grid grid-cols-4 gap-2">
              {ISLANDS.map(island => {
                const progress = progressMap.get(island.id);
                const unlocked = isUnlocked(island);
                const cleared = progress?.dungeonCleared ?? false;
                const discovered = save.discoveredIslands.includes(island.id);

                return (
                  <button
                    key={island.id}
                    onClick={() => unlocked && onIslandSelect(island)}
                    disabled={!unlocked}
                    className={`text-left rounded-xl p-3 border transition-all duration-200
                      ${cleared ? 'bg-emerald-950/50 border-emerald-500/30 hover:border-emerald-400/50' :
                        unlocked ? 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-sky-400/30' :
                        'bg-white/3 border-white/5 opacity-50 cursor-not-allowed'}
                    `}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: island.color }} />
                      <span className="text-white text-xs font-bold truncate">{island.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {cleared && <CheckCircle2 size={10} className="text-emerald-400" />}
                      {!unlocked && <Lock size={10} className="text-slate-500" />}
                      {!cleared && unlocked && <Skull size={10} className={discovered ? 'text-amber-400' : 'text-slate-500'} />}
                      <span className={`text-[9px] ${cleared ? 'text-emerald-400' : unlocked ? 'text-slate-400' : 'text-slate-600'}`}>
                        {cleared ? 'Temple cleared' : !unlocked ? `Req: ${island.requiredItem}` : discovered ? 'Temple awaits' : 'Undiscovered'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
