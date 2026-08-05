import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Check, Flame, Sparkles, Type, ChevronRight, X, Wand2 } from 'lucide-react';
import { ModalShell } from '../shared/ui/ModalShell';
import { Button } from '../shared/ui/Button';
import { useButtonHoverPreview } from '../context/ButtonHoverPreviewContext';
import {
  POINTER_SYMBOLS,
  CURSOR_COLOR_OPTIONS,
  ANIMATION_STYLES,
  TRAIL_STYLES,
  FONT_OPTIONS,
  BUTTON_HOVER_STYLES,
  UserCustomization,
  PointerSymbol,
  AnimationStyle,
  TrailStyle,
  ButtonHoverStyle,
  getEligibleFonts,
} from '../services/customizationService';
import { updateCompanionFont } from '../services/companionService';
import type { CompanionWithLastMessage } from '../services/companionService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customization: UserCustomization;
  companions?: CompanionWithLastMessage[];
  onSetPointer:           (key: string)   => void;
  onSetShowTrail:         (show: boolean) => void;
  onSetTrailStyle:        (style: string) => void;
  onSetAnimationStyle:    (style: string) => void;
  onSetCursorColor:       (key: string)   => void;
  onSetButtonHoverStyle:  (style: string) => void;
  onSetTranslucentUI:     (enabled: boolean) => void;
  onCompanionFontUpdated?: (companionId: string, fontFamily: string) => void;
}

type Tab = 'pointer' | 'effect' | 'rewards' | 'fonts';

function SymbolIcon({ symbol }: { symbol: PointerSymbol }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" stroke="none">
      <path d={symbol.svg} />
    </svg>
  );
}

function AnimIcon({ anim }: { anim: AnimationStyle }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" stroke="none">
      <path d={anim.icon} />
    </svg>
  );
}

const TRAIL_ICONS: Record<string, React.ReactNode> = {
  solid:   <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 12 Q9 6 15 12 Q21 18 24 12" /></svg>,
  dots:    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><circle cx="4" cy="12" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="22" cy="12" r="2"/></svg>,
  dashes:  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3"><line x1="2" y1="12" x2="22" y2="12" /></svg>,
  neon:    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="12" x2="21" y2="12" strokeWidth="6" strokeOpacity="0.3" /></svg>,
  rainbow: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="url(#rbGrad)" strokeWidth="2.5" strokeLinecap="round"><defs><linearGradient id="rbGrad"><stop offset="0%" stopColor="#f43f6b"/><stop offset="50%" stopColor="#38bdf8"/><stop offset="100%" stopColor="#34d399"/></linearGradient></defs><path d="M3 16 Q12 4 21 16" /></svg>,
  pulse:   <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeLinecap="round"><path d="M2 12 Q5 8 8 12 Q11 16 14 12 Q17 8 20 12 Q22 14 24 12" strokeWidth="2"/></svg>,
};

function TrailStyleBtn({ ts, active, unlocked, onClick }: {
  ts: TrailStyle; active: boolean; unlocked: boolean; onClick: () => void;
}) {
  return (
    <button
      disabled={!unlocked}
      onClick={onClick}
      style={{
        background:  active ? 'rgba(244,63,107,0.18)' : unlocked ? 'rgba(40,36,68,0.80)' : 'rgba(28,25,48,0.40)',
        borderColor: active ? 'rgba(244,63,107,0.70)' : 'rgba(60,55,100,0.60)',
      }}
      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${
        active     ? 'text-primary-400 shadow-glow'
        : unlocked ? 'text-ink-secondary hover:text-ink'
        : 'text-ink-disabled cursor-not-allowed opacity-50'
      }`}
    >
      {active && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary-500 rounded-full flex items-center justify-center">
          <Check className="w-2 h-2 text-white" />
        </span>
      )}
      {!unlocked && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(60,56,80,0.90)' }}>
          <Lock className="w-2 h-2 text-ink-disabled" />
        </span>
      )}
      {TRAIL_ICONS[ts.key]}
      <span className="text-2xs font-medium text-center">{ts.label}</span>
      {!unlocked && (
        <span className="text-2xs text-ink-subtle text-center leading-tight">{ts.unlockLabel}</span>
      )}
    </button>
  );
}

const HOVER_STYLE_ICONS: Record<string, React.ReactNode> = {
  none:   <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" strokeDasharray="4 3" opacity="0.5" /></svg>,
  portal: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>,
  ripple: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6" opacity="0.65"/><circle cx="12" cy="12" r="9" opacity="0.35"/></svg>,
  aurora: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 8 Q9 4 15 8 Q21 12 15 16 Q9 20 3 16"/><path d="M6 6 Q12 2 18 6" opacity="0.5"/><path d="M6 18 Q12 22 18 18" opacity="0.5"/></svg>,
  sparks: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  ember:  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2c0 6-6 8-6 14a6 6 0 0 0 12 0c0-6-6-8-6-14z"/><path d="M12 17a2 2 0 0 1-2-2c0-2 2-3 2-3s2 1 2 3a2 2 0 0 1-2 2z" fill="currentColor" opacity="0.6"/></svg>,
};

function ButtonHoverBtn({ style, active, onClick, onMouseEnter, onMouseLeave }: {
  style: ButtonHoverStyle; active: boolean; onClick: () => void;
  onMouseEnter?: () => void; onMouseLeave?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background:  active ? 'rgba(244,63,107,0.18)' : 'rgba(40,36,68,0.80)',
        borderColor: active ? 'rgba(244,63,107,0.70)' : 'rgba(60,55,100,0.60)',
      }}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 ${
        active ? 'text-primary-400 shadow-glow' : 'text-ink-secondary hover:text-ink'
      }`}
    >
      {active && (
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary-500 rounded-full flex items-center justify-center">
          <Check className="w-2 h-2 text-white" />
        </span>
      )}
      {HOVER_STYLE_ICONS[style.key] ?? <Wand2 className="w-5 h-5" />}
      <span className="text-2xs font-medium text-center leading-tight">{style.label}</span>
      <span className="text-2xs text-ink-subtle text-center leading-tight">{style.description}</span>
    </button>
  );
}

function FontPickerModal({
  companion,
  companions,
  onClose,
  onSave,
}: {
  companion: CompanionWithLastMessage;
  companions: CompanionWithLastMessage[];
  onClose: () => void;
  onSave: (fontFamily: string) => void;
}) {
  const [selected, setSelected] = useState(companion.font_family ?? '');
  const [saving, setSaving] = useState(false);

  const eligible = getEligibleFonts(companion.gender);
  const takenByOthers = new Set(
    companions
      .filter(c => c.id !== companion.id && c.font_family)
      .map(c => c.font_family as string)
  );

  const handleSave = async () => {
    if (!selected || selected === companion.font_family) { onClose(); return; }
    setSaving(true);
    await updateCompanionFont(companion.id, selected);
    onSave(selected);
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.70)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'rgba(22,19,44,0.98)', border: '1px solid rgba(80,70,130,0.50)', boxShadow: '0 20px 60px rgba(0,0,0,0.60)' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(60,55,100,0.40)' }}>
          <div>
            <p className="text-sm font-bold text-ink">Choose Font</p>
            <p className="text-xs text-ink-muted mt-0.5" style={{ fontFamily: companion.font_family ?? undefined }}>
              {companion.custom_name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-muted hover:text-ink transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
          {FONT_OPTIONS.map(font => {
            const isEligible = eligible.some(f => f.key === font.key);
            const isTaken    = takenByOthers.has(font.fontFamily);
            const isActive   = selected === font.fontFamily;
            const selectable = isEligible && !isTaken;

            return (
              <button
                key={font.key}
                disabled={!selectable}
                onClick={() => selectable && setSelected(font.fontFamily)}
                style={{
                  background:  isActive ? 'rgba(244,63,107,0.18)' : selectable ? 'rgba(40,36,68,0.80)' : 'rgba(28,25,48,0.40)',
                  borderColor: isActive ? 'rgba(244,63,107,0.70)' : 'rgba(60,55,100,0.50)',
                  width: '100%', textAlign: 'left',
                }}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150 ${
                  isActive     ? 'text-primary-300'
                  : selectable ? 'text-ink-secondary hover:text-ink'
                  : 'text-ink-disabled cursor-not-allowed opacity-40'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ fontFamily: font.fontFamily }}>
                    {font.label}
                  </p>
                  <p className="text-xs opacity-70 truncate mt-0.5" style={{ fontFamily: font.fontFamily }}>
                    {font.sample}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {isTaken && (
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(60,55,100,0.60)', color: 'rgba(160,155,200,0.80)' }}>
                      Taken
                    </span>
                  )}
                  {!isEligible && !isTaken && (
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(60,55,100,0.40)', color: 'rgba(120,115,160,0.80)' }}>
                      Other
                    </span>
                  )}
                  {isActive && <Check className="w-4 h-4 text-primary-400" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 px-5 py-4" style={{ borderTop: '1px solid rgba(60,55,100,0.40)' }}>
          <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Saving...' : 'Apply'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export function CustomizationPanel({
  isOpen, onClose, customization, companions = [],
  onSetPointer, onSetShowTrail, onSetTrailStyle, onSetAnimationStyle, onSetCursorColor,
  onSetButtonHoverStyle, onSetTranslucentUI, onCompanionFontUpdated,
}: Props) {
  const [tab, setTab] = useState<Tab>('pointer');
  const [editingCompanion, setEditingCompanion] = useState<CompanionWithLastMessage | null>(null);
  const [localCompanions, setLocalCompanions] = useState<CompanionWithLastMessage[]>(companions);
  const streak = customization.current_streak;
  const fontUnlocked = customization.font_customization_unlocked;
  const { setPreviewStyle } = useButtonHoverPreview();

  React.useEffect(() => {
    setLocalCompanions(companions);
  }, [companions]);

  useEffect(() => {
    if (!isOpen || tab !== 'rewards') {
      setPreviewStyle(null);
    }
  }, [isOpen, tab, setPreviewStyle]);

  return (
    <>
    <ModalShell isOpen={isOpen} onClose={onClose} title="Customize" size="lg" closeOnBackdrop>
      <div className="flex flex-col gap-4">

        <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'rgba(49,45,85,0.50)', border: '1px solid rgba(80,70,130,0.40)' }}>
          <div className="flex items-center gap-1.5 text-warning-500">
            <Flame className="w-4 h-4" />
            <span className="text-sm font-bold">{streak}</span>
          </div>
          <span className="text-xs text-ink-muted">day streak</span>
          <div className="ml-auto flex items-center gap-1.5 text-ink-subtle text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            {customization.total_checkins} sign-ins
          </div>
        </div>

        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(80,70,130,0.40)' }}>
          {(['pointer', 'effect', 'rewards', 'fonts'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                tab === t ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-ink-secondary'
              }`}
              style={tab !== t ? { background: 'rgba(28,25,48,0.60)' } : {}}
            >
              {t === 'pointer' ? 'Pointer'
                : t === 'effect' ? 'Cursor'
                : t === 'rewards' ? (
                  <>
                    <Wand2 className="w-3 h-3" />
                    FX
                  </>
                ) : (
                  <>
                    <Type className="w-3 h-3" />
                    Fonts
                    {!fontUnlocked && <Lock className="w-2.5 h-2.5 opacity-70" />}
                  </>
                )
              }
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'pointer' && (
            <motion.div key="pointer"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              <p className="text-xs text-ink-muted">Keep your daily streak going to unlock more symbols.</p>

              <div className="grid grid-cols-5 gap-3">
                {POINTER_SYMBOLS.map(sym => {
                  const unlocked = customization.unlocked_pointers.includes(sym.key);
                  const active   = customization.active_pointer === sym.key;
                  return (
                    <button key={sym.key} disabled={!unlocked}
                      onClick={() => unlocked && onSetPointer(sym.key)}
                      style={{
                        background:  active ? 'rgba(244,63,107,0.18)' : unlocked ? 'rgba(40,36,68,0.80)' : 'rgba(28,25,48,0.50)',
                        borderColor: active ? 'rgba(244,63,107,0.70)' : 'rgba(60,55,100,0.60)',
                      }}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 ${
                        active        ? 'text-primary-400 shadow-glow'
                        : unlocked    ? 'text-ink-secondary hover:text-ink'
                        : 'text-ink-disabled cursor-not-allowed opacity-50'
                      }`}
                    >
                      {active && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                      {!unlocked && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(60,56,80,0.90)' }}>
                          <Lock className="w-2.5 h-2.5 text-ink-disabled" />
                        </span>
                      )}
                      <SymbolIcon symbol={sym} />
                      <span className="text-2xs font-medium leading-tight text-center">{sym.label}</span>
                      {!unlocked && (
                        <span className="text-2xs text-ink-subtle leading-tight text-center">{sym.unlockLabel}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl p-3 space-y-2"
                style={{ background: 'rgba(28,25,48,0.60)', border: '1px solid rgba(60,55,100,0.40)' }}>
                <p className="text-xs font-semibold text-ink-secondary">Milestones</p>
                {POINTER_SYMBOLS.filter(s => s.unlockDay > 0).map(sym => {
                  const done = customization.unlocked_pointers.includes(sym.key);
                  return (
                    <div key={sym.key} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-success-500' : 'bg-surface-300'}`} />
                      <span className={`text-xs ${done ? 'text-success-500 line-through opacity-70' : 'text-ink-muted'}`}>
                        {sym.unlockLabel} — {sym.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {tab === 'effect' && (
            <motion.div key="effect"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              {/* UI Translucency */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(60,55,100,0.50)' }}>
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ background: 'rgba(28,25,48,0.70)' }}>
                  <div>
                    <p className="text-xs font-semibold text-ink-secondary">Translucent UI</p>
                    <p className="text-xs text-ink-muted mt-0.5">Makes sidebars and bottom bar fade into background</p>
                  </div>
                  <button
                    onClick={() => onSetTranslucentUI(!customization.translucent_ui)}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
                      customization.translucent_ui ? 'bg-primary-600' : 'bg-surface-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                      customization.translucent_ui ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Trail + particle toggles */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(60,55,100,0.50)' }}>
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ background: 'rgba(28,25,48,0.70)' }}>
                  <div>
                    <p className="text-xs font-semibold text-ink-secondary">Trail line</p>
                    <p className="text-xs text-ink-muted mt-0.5">Glowing path drawn behind your cursor</p>
                  </div>
                  <button
                    onClick={() => onSetShowTrail(!customization.show_trail)}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
                      customization.show_trail ? 'bg-primary-600' : 'bg-surface-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                      customization.show_trail ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ background: 'rgba(22,19,44,0.70)', borderTop: '1px solid rgba(60,55,100,0.35)' }}>
                  <div>
                    <p className="text-xs font-semibold text-ink-secondary">Particles</p>
                    <p className="text-xs text-ink-muted mt-0.5">Animated effects that burst from cursor</p>
                  </div>
                  <button
                    onClick={() => onSetAnimationStyle(customization.animation_style !== 'none' ? 'none' : 'stars')}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${
                      customization.animation_style !== 'none' ? 'bg-primary-600' : 'bg-surface-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                      customization.animation_style !== 'none' ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Color swatches */}
              <div>
                <p className="text-xs font-semibold text-ink-secondary mb-3">Color</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {CURSOR_COLOR_OPTIONS.map(opt => {
                    const sel   = customization.cursor_color === opt.key;
                    const color = opt.particles[0];
                    return (
                      <button key={opt.key} onClick={() => onSetCursorColor(opt.key)} title={opt.label}
                        style={{
                          appearance: 'none', WebkitAppearance: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
                          background: color,
                          border: sel ? '3px solid #fff' : '3px solid rgba(255,255,255,0.08)',
                          outline: sel ? `3px solid ${color}` : 'none', outlineOffset: 2,
                          boxShadow: sel ? `0 0 16px ${color}` : 'none',
                          transform: sel ? 'scale(1.18)' : 'scale(1)',
                          transition: 'all 0.15s ease', cursor: 'pointer', padding: 0,
                        }}
                      >
                        {sel && (
                          <Check style={{ width: 14, height: 14, color: '#fff',
                            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))', flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-ink-muted mt-2">Applied to both trail and particles</p>
              </div>

              {/* Trail style picker — shown when trail is on */}
              {customization.show_trail && (
                <div>
                  <p className="text-xs font-semibold text-ink-secondary mb-3">Trail style</p>
                  <div className="grid grid-cols-3 gap-2">
                    {TRAIL_STYLES.map(ts => {
                      const unlocked = ts.unlockDay === 0 || streak >= ts.unlockDay;
                      const active   = customization.trail_style === ts.key;
                      return (
                        <TrailStyleBtn key={ts.key} ts={ts} active={active} unlocked={unlocked}
                          onClick={() => unlocked && onSetTrailStyle(ts.key)} />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Particle style picker — shown when particles are on */}
              {customization.animation_style !== 'none' && (
                <div>
                  <p className="text-xs font-semibold text-ink-secondary mb-3">Particle style</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ANIMATION_STYLES.filter(a => a.key !== 'none').map(anim => {
                      const unlocked = anim.unlockDay === 0 || streak >= anim.unlockDay;
                      const active   = customization.animation_style === anim.key;
                      return (
                        <button key={anim.key}
                          disabled={!unlocked}
                          onClick={() => unlocked && onSetAnimationStyle(anim.key)}
                          style={{
                            background:  active ? 'rgba(244,63,107,0.18)' : unlocked ? 'rgba(40,36,68,0.80)' : 'rgba(28,25,48,0.40)',
                            borderColor: active ? 'rgba(244,63,107,0.70)' : 'rgba(60,55,100,0.60)',
                          }}
                          className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${
                            active     ? 'text-primary-400 shadow-glow'
                            : unlocked ? 'text-ink-secondary hover:text-ink'
                            : 'text-ink-disabled cursor-not-allowed opacity-50'
                          }`}
                        >
                          {active && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary-500 rounded-full flex items-center justify-center">
                              <Check className="w-2 h-2 text-white" />
                            </span>
                          )}
                          {!unlocked && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                              style={{ background: 'rgba(60,56,80,0.90)' }}>
                              <Lock className="w-2 h-2 text-ink-disabled" />
                            </span>
                          )}
                          <AnimIcon anim={anim} />
                          <span className="text-2xs font-medium text-center">{anim.label}</span>
                          {!unlocked && (
                            <span className="text-2xs text-ink-subtle text-center leading-tight">{anim.unlockLabel}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
          {tab === 'rewards' && (
            <motion.div key="rewards"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <div>
                <p className="text-xs font-semibold text-ink-secondary mb-1">Button Hover Effects</p>
                <p className="text-xs text-ink-muted mb-4">Animated effects that play when you hover over buttons.</p>
                <div className="grid grid-cols-2 gap-2">
                  {BUTTON_HOVER_STYLES.map(style => (
                    <ButtonHoverBtn
                      key={style.key}
                      style={style}
                      active={(customization.button_hover_style ?? 'none') === style.key}
                      onClick={() => onSetButtonHoverStyle(style.key)}
                      onMouseEnter={() => setPreviewStyle(style.key)}
                      onMouseLeave={() => setPreviewStyle(null)}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'fonts' && (
            <motion.div key="fonts"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {!fontUnlocked ? (
                <div className="rounded-2xl p-6 text-center space-y-3"
                  style={{ background: 'rgba(28,25,48,0.60)', border: '1px solid rgba(60,55,100,0.40)' }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
                    style={{ background: 'rgba(60,55,100,0.50)' }}>
                    <Lock className="w-6 h-6 text-ink-disabled" />
                  </div>
                  <p className="text-sm font-semibold text-ink-secondary">Companion Fonts</p>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Give each companion their own unique font — unlocks at a <span className="text-warning-400 font-semibold">20-day streak</span>.
                  </p>
                  <div className="rounded-xl px-4 py-3 mt-2"
                    style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)' }}>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-ink-muted">Current streak</span>
                      <span className="font-bold text-warning-400">{streak} / 20 days</span>
                    </div>
                    <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(60,55,100,0.50)' }}>
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (streak / 20) * 100)}%`, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-ink-muted">Each companion has their own font identity. Tap Edit to change one.</p>
                  {localCompanions.length === 0 ? (
                    <p className="text-xs text-ink-subtle text-center py-4">No companions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {localCompanions.map(companion => {
                        const currentFont = FONT_OPTIONS.find(f => f.fontFamily === companion.font_family);
                        return (
                          <div key={companion.id}
                            className="flex items-center justify-between px-4 py-3 rounded-xl"
                            style={{ background: 'rgba(40,36,68,0.80)', border: '1px solid rgba(60,55,100,0.50)' }}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-ink truncate"
                                style={{ fontFamily: companion.font_family ?? undefined }}>
                                {companion.custom_name}
                              </p>
                              <p className="text-xs text-ink-muted mt-0.5">
                                {currentFont ? (
                                  <span style={{ fontFamily: companion.font_family ?? undefined }}>
                                    {currentFont.label}
                                  </span>
                                ) : 'No font assigned'}
                              </p>
                            </div>
                            <button
                              onClick={() => setEditingCompanion(companion)}
                              className="flex items-center gap-1 text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors flex-shrink-0 ml-3"
                            >
                              Edit <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-end pt-2" style={{ borderTop: '1px solid rgba(60,55,100,0.40)' }}>
          <Button variant="secondary" size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    </ModalShell>

    <AnimatePresence>
      {editingCompanion && (
        <FontPickerModal
          companion={editingCompanion}
          companions={localCompanions}
          onClose={() => setEditingCompanion(null)}
          onSave={(fontFamily) => {
            setLocalCompanions(prev =>
              prev.map(c => c.id === editingCompanion.id ? { ...c, font_family: fontFamily } : c)
            );
            onCompanionFontUpdated?.(editingCompanion.id, fontFamily);
          }}
        />
      )}
    </AnimatePresence>
    </>
  );
}
