import { Shield, Star, Clock, Sword, Gem, Heart, RotateCcw, ArrowLeft } from 'lucide-react';
import type { DungeonRunResult, IslandDef } from './rpgTypes';

interface Props {
  island: IslandDef;
  result: DungeonRunResult;
  onRetry: () => void;
  onLeave: () => void;
}

const ITEM_LABELS: Record<string, string> = {
  rupees_5: '5 Rupees',
  rupees_20: '20 Rupees',
  rupees_50: '50 Rupees',
  heart_piece: 'Heart Container',
  sword: 'Short Sword',
  shield: 'Wooden Shield',
  hookshot: 'Hookshot',
  bow: "Hero's Bow",
  map: 'Island Chart',
};

export function DungeonResultModal({ island, result, onRetry, onLeave }: Props) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-sm mx-4">
        <div
          className="bg-gradient-to-b from-slate-900/98 to-slate-950/98 border rounded-3xl shadow-2xl overflow-hidden"
          style={{ borderColor: island.dungeonColor + '60' }}
        >
          <div
            className="px-6 py-5 text-center"
            style={{ background: `${island.dungeonColor}22` }}
          >
            <div
              className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center border-2"
              style={{ borderColor: island.dungeonColor, background: island.dungeonColor + '30' }}
            >
              {result.completed ? (
                <Star className="text-amber-300" size={28} />
              ) : (
                <Shield className="text-slate-400" size={28} />
              )}
            </div>
            <h2 className="text-white font-bold text-2xl">
              {result.completed ? 'Temple Cleared!' : 'Fled the Temple'}
            </h2>
            <p className="text-white/40 text-sm mt-1">
              {result.completed ? `${island.bossName} has been defeated` : `${island.name} — Temple run ended`}
            </p>
          </div>

          <div className="p-5 grid grid-cols-2 gap-2">
            <StatTile icon={<Sword size={13} className="text-red-400" />} label="Enemies Slain" value={String(result.enemiesDefeated)} />
            <StatTile icon={<Gem size={13} className="text-emerald-400" />} label="Rupees Found" value={String(result.rupeesFound)} />
            <StatTile icon={<Heart size={13} className="text-pink-400" />} label="Damage Taken" value={`${result.damageTaken} HP`} />
            <StatTile icon={<Clock size={13} className="text-sky-400" />} label="Time" value={formatTime(result.timeSeconds)} />
          </div>

          {result.completed && result.itemFound && (
            <div className="mx-5 mb-4 bg-amber-950/50 border border-amber-500/30 rounded-xl px-4 py-3 text-center">
              <div className="text-amber-400/70 text-xs mb-1">Item Obtained</div>
              <div className="text-amber-200 font-bold text-base">{ITEM_LABELS[result.itemFound] ?? result.itemFound}</div>
            </div>
          )}

          <div className="px-5 pb-5 flex gap-3">
            <button
              onClick={onRetry}
              className="flex-1 flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-600 text-white font-bold py-3 rounded-xl transition-all hover:scale-105 text-sm"
            >
              <RotateCcw size={14} />
              Try Again
            </button>
            <button
              onClick={onLeave}
              className="flex-1 flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 text-white/80 hover:text-white font-medium py-3 rounded-xl transition-all border border-white/10 text-sm"
            >
              <ArrowLeft size={14} />
              Leave Isle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
      <div className="flex items-center gap-1.5 text-white/40 text-xs mb-1">
        {icon} {label}
      </div>
      <div className="text-white font-bold text-base font-mono">{value}</div>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
