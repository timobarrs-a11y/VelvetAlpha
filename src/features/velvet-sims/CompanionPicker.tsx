import { Heart, Users } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import type { Companion } from '../../services/companionService';

interface Props {
  companions: Companion[];
  currentId: string | null;
  /** `new`: who is moving in. `continue`: whose house to go back to. */
  mode: 'new' | 'continue';
  /** The day each companion's house has reached; null or missing when they have no house yet. */
  days: Record<string, number | null>;
  onPick: (id: string) => void;
  onCancel: () => void;
}

/**
 * Who? Shown over the game when the player chooses Start or Continue and has more than one companion (a partner and a
 * friend, say), each with a house of their own. A partner gets the couple's story and a friend gets the roommates' one.
 */
export function CompanionPicker({ companions, currentId, mode, days, onPick, onCancel }: Props) {
  const title = mode === 'continue' ? 'Whose house?' : "Who's moving in?";
  const sub = mode === 'continue' ? 'Pick the house to go back to.' : "Pick who you'll share the house with.";
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#17151D] p-5 text-white shadow-2xl">
        <h2 className="m-0 text-center text-xl font-extrabold">{title}</h2>
        <p className="mb-4 mt-1 text-center text-sm text-white/60">{sub}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {companions.map((c) => {
            const partner = c.relationship_type === 'romantic';
            const day = days[c.id] ?? null;
            const note = mode === 'continue'
              ? (day !== null ? `Day ${day}` : 'No house yet: start one')
              : (day !== null ? `Day ${day} · a new house puts it away` : 'New house');
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onPick(c.id)}
                aria-label={`${c.custom_name}, ${partner ? 'partner' : 'friend'}`}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors hover:bg-white/10 ${c.id === currentId ? 'border-pink-400/70 bg-white/5' : 'border-white/10'}`}
              >
                <div className="h-28 w-28 overflow-hidden rounded-2xl bg-white/5">
                  {c.avatar_config ? <Avatar config={c.avatar_config} className="h-full w-full" /> : null}
                </div>
                <span className="text-base font-bold">{c.custom_name}</span>
                <span className={`flex items-center gap-1 text-xs font-semibold ${partner ? 'text-pink-300' : 'text-teal-300'}`}>
                  {partner ? <Heart className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  {partner ? 'Partner' : 'Friend · roommates'}
                </span>
                <span className="text-[11.5px] text-white/50">{note}</span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onCancel} className="mt-4 w-full py-2 text-sm text-white/60 hover:text-white">Back</button>
      </div>
    </div>
  );
}
