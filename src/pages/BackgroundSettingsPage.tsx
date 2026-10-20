import { ArrowLeft, Check, Layers3, MessageCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TOOLBAR_BACKGROUND_MODES, type ToolbarBackgroundMode } from '../services/customizationService';
import { useCustomization } from '../hooks/useCustomization';

const MODE_ICONS: Record<ToolbarBackgroundMode, typeof Sparkles> = {
  glass: Sparkles,
  companion: MessageCircle,
  coaching: Layers3,
};

const MODE_PREVIEWS: Record<ToolbarBackgroundMode, string> = {
  glass: 'bg-gradient-to-br from-slate-500/35 via-slate-300/10 to-slate-900',
  companion: 'bg-gradient-to-br from-rose-400/70 via-orange-300/40 to-slate-900',
  coaching: 'bg-gradient-to-br from-emerald-400/65 via-sky-400/30 to-slate-950',
};

export function BackgroundSettingsPage() {
  const navigate = useNavigate();
  const { customization, loading, setToolbarBackgroundMode } = useCustomization();
  const selected = customization?.toolbar_background_mode ?? 'glass';

  return (
    <main className="min-h-full overflow-y-auto bg-[#0b1020] px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-4xl">
        <button type="button" onClick={() => navigate('/lobby')} className="mb-8 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/60 transition hover:bg-white/8 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to Velvet
        </button>

        <div className="mb-8 max-w-2xl">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">Workspace background</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Choose the background behind your workspace controls.</h1>
          <p className="mt-3 text-sm leading-6 text-white/55">This page only changes the background treatment used by the workspace toolbar. Account preferences and companion chat settings are kept separate.</p>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Background styles</h2>
              <p className="mt-1 text-sm text-white/45">Changes save automatically.</p>
            </div>
            {loading && <span className="text-xs text-white/40">Loading your choice...</span>}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {TOOLBAR_BACKGROUND_MODES.map(mode => {
              const Icon = MODE_ICONS[mode.key];
              const active = selected === mode.key;
              return (
                <button
                  key={mode.key}
                  type="button"
                  disabled={loading}
                  onClick={() => setToolbarBackgroundMode(mode.key)}
                  className={`group overflow-hidden rounded-2xl border text-left transition ${active ? 'border-rose-400/70 bg-rose-500/10 shadow-lg shadow-rose-950/20' : 'border-white/10 bg-black/10 hover:border-white/25 hover:bg-white/[0.06]'} disabled:cursor-wait disabled:opacity-70`}
                  aria-pressed={active}
                >
                  <div className={`relative h-28 ${MODE_PREVIEWS[mode.key]}`}>
                    <div className="absolute inset-4 rounded-xl border border-white/30 bg-white/15 shadow-lg backdrop-blur-md" />
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-white/20 bg-black/25 px-2.5 py-1.5 text-[10px] font-semibold text-white backdrop-blur-md">
                      <Icon className="h-3.5 w-3.5" />
                      Velvet
                    </div>
                    {active && <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-rose-400 text-slate-950"><Check className="h-3.5 w-3.5" /></span>}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold">{mode.label}</p>
                    <p className="mt-1 text-xs leading-5 text-white/45">{mode.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
