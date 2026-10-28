import { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createCrew } from '../../services/spacesService';
import type { SpaceVisibility } from '../../types/spaces';
import { SpaceIcon } from './SpaceIcon';
import { DOOR_OPTIONS } from './doors';
import { toast } from '../../shared/ui/Toast';

const ICON_OPTIONS = ['Gamepad2', 'Coffee', 'Dumbbell', 'Film', 'Music', 'BookOpen', 'Palette', 'Trophy', 'Heart', 'Cpu'];
const COLOR_OPTIONS = ['pink', 'rose', 'amber', 'blue', 'emerald', 'violet', 'teal', 'green'];


interface Props {
  parentSpace: { board_id: string; name: string; category: string; icon: string; color: string };
  onClose: () => void;
  onCreated: (boardId: string) => void;
}

export function StartCrewModal({ parentSpace, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Gamepad2');
  const [color, setColor] = useState('pink');
  const [visibility, setVisibility] = useState<SpaceVisibility>('request');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const newId = await createCrew({
        parentId: parentSpace.board_id,
        name: name.trim(),
        description: description.trim(),
        icon,
        color,
        visibility,
        category: parentSpace.category,
      });
      toast.success('Crew created!');
      onCreated(newId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create crew');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--ds-surface-2)] shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2">
              <SpaceIcon name={parentSpace.icon} color={parentSpace.color} className="w-4 h-4" />
              <h2 className="text-sm font-bold text-ink">Start a crew in {parentSpace.name}</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
              <X className="w-4 h-4 text-ink-muted" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="text-xs font-medium text-ink-muted mb-1.5 block">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. 2K27 Crew"
                maxLength={50}
                className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-muted mb-1.5 block">Description</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What's this crew about?"
                maxLength={200}
                className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-muted mb-1.5 block">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map(ic => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      icon === ic ? 'bg-white/15 ring-1 ring-white/20' : 'bg-white/5 hover:bg-white/8'
                    }`}
                  >
                    <SpaceIcon name={ic} color={color} className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-muted mb-1.5 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition-all ${
                      color === c ? 'ring-2 ring-white/30 scale-110' : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: `var(--color-${c}, ${c})` }}
                  >
                    <SpaceIcon name={icon} color={c} className="w-4 h-4 m-auto" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-muted mb-1.5 block">Door</label>
              <div className="space-y-2">
                {DOOR_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setVisibility(opt.key)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                      visibility === opt.key ? 'bg-white/10 border border-white/15' : 'bg-white/5 border border-white/8 hover:bg-white/8'
                    }`}
                  >
                    <span className="text-sm font-medium text-ink block">{opt.label}</span>
                    <span className="text-xs text-ink-muted">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-white/8 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || busy}
              className="px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {busy ? 'Creating...' : 'Create crew'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
