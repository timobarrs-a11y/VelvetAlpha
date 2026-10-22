import { useState } from 'react';
import { Check } from 'lucide-react';
import { ModalShell } from '../../shared/ui';
import { MedalBadge } from './MedalBadge';
import type { UserMedal } from '../../services/medalsService';
import { setShowcase } from '../../services/medalsService';
import { toast } from '../../shared/ui/Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  medals: UserMedal[];
  onSaved: () => void;
}

export function ShowcasePicker({ isOpen, onClose, medals, onSaved }: Props) {
  const earned = medals.filter(m => m.earned_at);
  const initial = medals.filter(m => m.showcase_slot !== null).sort((a, b) => (a.showcase_slot! - b.showcase_slot!)).map(m => m.slug);
  const [picked, setPicked] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);

  const toggle = (slug: string) => {
    if (picked.includes(slug)) {
      setPicked(picked.filter(s => s !== slug));
    } else if (picked.length < 3) {
      setPicked([...picked, slug]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setShowcase(picked);
      toast.success('Showcase updated!');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save showcase');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Choose your showcase medals"
      size="md"
      footer={
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-muted">{picked.length} / 3 selected</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      <p className="text-xs text-ink-muted mb-4">Pick up to 3 earned medals to display on your profile. They'll show in the order you select them.</p>
      <div className="space-y-1.5">
        {earned.map(medal => {
          const selected = picked.includes(medal);
          const order = picked.indexOf(medal.slug);
          return (
            <button
              key={medal.slug}
              onClick={() => toggle(medal.slug)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${
                selected ? 'bg-pink-500/15 border border-pink-500/30' : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <MedalBadge icon={medal.icon} tier={medal.tier as any} size="md" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-ink block truncate">{medal.name}</span>
                <span className="text-[10px] text-ink-muted/60 block truncate">{medal.description}</span>
              </div>
              {selected && (
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {order + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </ModalShell>
  );
}
