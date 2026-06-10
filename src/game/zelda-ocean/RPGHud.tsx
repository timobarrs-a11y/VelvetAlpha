import { Gem, Sword, Shield, Crosshair, Zap, BookOpen } from 'lucide-react';
import type { RPGSave } from './rpgTypes';

interface Props {
  save: RPGSave;
  onMapOpen: () => void;
  onJournalOpen: () => void;
}

export function RPGHud({ save, onMapOpen, onJournalOpen }: Props) {
  const maxHearts = Math.ceil(save.maxHealth / 2);
  const filledHearts = Math.ceil(save.currentHealth / 2);
  const halfHeart = save.currentHealth % 2 === 1;

  return (
    <div className="absolute top-14 left-4 z-30 flex flex-col gap-2 pointer-events-none select-none">
      <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: maxHearts }).map((_, i) => {
            const isHalf = i === filledHearts - 1 && halfHeart;
            const isFull = i < filledHearts - (halfHeart ? 1 : 0);
            return (
              <HeartIcon key={i} full={isFull} half={isHalf} />
            );
          })}
        </div>
      </div>

      <div className="bg-black/60 backdrop-blur-sm border border-emerald-400/20 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
        <Gem size={12} className="text-emerald-400" />
        <span className="text-emerald-300 text-sm font-bold font-mono">{save.rupeeWallet}</span>
      </div>

      <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
        <span className="text-white/40 text-[9px] font-mono mr-1">GEAR</span>
        <ItemSlot icon={<Sword size={11} />} owned={save.hasSword} label="Sword" />
        <ItemSlot icon={<Shield size={11} />} owned={save.hasShield} label="Shield" />
        <ItemSlot icon={<Crosshair size={11} />} owned={save.hasHookshot} label="Hook" />
        <ItemSlot icon={<Zap size={11} />} owned={save.hasBow} label="Bow" />
      </div>

      <div className="flex gap-2 pointer-events-auto">
        <button
          onClick={onMapOpen}
          className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-sky-400/20 hover:border-sky-400/50 rounded-lg px-3 py-1.5 text-sky-300 text-xs font-medium transition-all"
        >
          <BookOpen size={11} />
          Map
        </button>
        <button
          onClick={onJournalOpen}
          className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-amber-400/20 hover:border-amber-400/50 rounded-lg px-3 py-1.5 text-amber-300 text-xs font-medium transition-all"
        >
          <BookOpen size={11} />
          Quests
        </button>
      </div>
    </div>
  );
}

function HeartIcon({ full, half }: { full: boolean; half: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="halfGrad" x1="0" x2="1" y2="0">
          <stop offset="50%" stopColor="#f87171" />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        fill={full ? '#f87171' : half ? 'url(#halfGrad)' : 'rgba(100,60,60,0.3)'}
        stroke={full || half ? '#f87171' : '#4a2a2a'}
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ItemSlot({ icon, owned, label }: { icon: React.ReactNode; owned: boolean; label: string }) {
  return (
    <div
      title={label}
      className={`w-6 h-6 flex items-center justify-center rounded transition-colors
        ${owned ? 'text-amber-300' : 'text-white/15'}
      `}
    >
      {icon}
    </div>
  );
}
