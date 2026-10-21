import { Plus } from 'lucide-react';
import type { UserMedal } from '../../services/medalsService';
import { MedalBadge } from './MedalBadge';

interface Props {
  medals: UserMedal[];
  isOwn?: boolean;
  onEdit?: () => void;
}

export function MedalShowcase({ medals, isOwn = false, onEdit }: Props) {
  const showcase = [1, 2, 3].map(slot => medals.find(m => m.showcase_slot === slot) ?? null);

  return (
    <div className="flex items-center gap-4">
      {showcase.map((medal, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          {medal ? (
            <MedalBadge icon={medal.icon} tier={medal.tier as any} size="lg" />
          ) : (
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-white/15 flex items-center justify-center">
              {isOwn && (
                <button onClick={onEdit} className="text-ink-muted/50 hover:text-ink-muted transition-colors" title="Pin a medal">
                  <Plus className="w-6 h-6" />
                </button>
              )}
            </div>
          )}
          {medal && (
            <span className="text-[10px] text-ink-muted text-center max-w-[80px] truncate">{medal.name}</span>
          )}
          {isOwn && !medal && i === 0 && (
            <span className="text-[10px] text-ink-muted/50">Pin a medal</span>
          )}
        </div>
      ))}
    </div>
  );
}
