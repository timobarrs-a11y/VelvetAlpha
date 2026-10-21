import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil } from 'lucide-react';
import { getUserMedals, type UserMedal } from '../services/medalsService';
import { MedalShowcase } from '../components/medals/MedalShowcase';
import { MedalCase } from '../components/medals/MedalCase';
import { ShowcasePicker } from '../components/medals/ShowcasePicker';

export default function MedalsPage() {
  const navigate = useNavigate();
  const [medals, setMedals] = useState<UserMedal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const m = await getUserMedals();
      setMedals(m);
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const earnedCount = medals.filter(m => m.earned_at).length;

  return (
    <div className="ds-page text-white h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <button onClick={() => navigate('/lobby')} className="mb-4 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Medals</h1>
          <p className="text-sm text-ink-muted">{earnedCount} earned · {medals.length - earnedCount} to go</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-ink-muted animate-spin" />
          </div>
        ) : (
          <>
            <div className="mb-8 p-5 rounded-2xl bg-white/5 border border-white/8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-ink">Showcase</h2>
                <button
                  onClick={() => setShowPicker(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-ink-muted hover:text-ink transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              </div>
              <MedalShowcase medals={medals} isOwn onEdit={() => setShowPicker(true)} />
            </div>

            <MedalCase medals={medals} isOwn />
          </>
        )}

        {showPicker && (
          <ShowcasePicker
            isOpen={showPicker}
            onClose={() => setShowPicker(false)}
            medals={medals}
            onSaved={load}
          />
        )}
      </div>
    </div>
  );
}
