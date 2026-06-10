import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Type, Palette, Sparkles, Check, ToggleLeft, ToggleRight, Image } from 'lucide-react';
import {
  FONT_OPTIONS,
  ANIMATION_STYLES,
  TRAIL_STYLES,
  UserCustomization,
} from '../services/customizationService';
import { updateCompanionChatStyle } from '../services/companionService';

// ─── Bubble color palette ────────────────────────────────────────────────────
export interface BubbleColorOption {
  key: string;
  label: string;
  bg: string;
  preview: string;
}

export const BUBBLE_COLORS: BubbleColorOption[] = [
  { key: 'rose',     label: 'Rose',     bg: 'linear-gradient(135deg,#f43f5e,#ec4899)', preview: '#f43f5e' },
  { key: 'sky',      label: 'Sky',      bg: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', preview: '#0ea5e9' },
  { key: 'emerald',  label: 'Emerald',  bg: 'linear-gradient(135deg,#10b981,#34d399)', preview: '#10b981' },
  { key: 'amber',    label: 'Amber',    bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)', preview: '#f59e0b' },
  { key: 'coral',    label: 'Coral',    bg: 'linear-gradient(135deg,#f97316,#fb923c)', preview: '#f97316' },
  { key: 'midnight', label: 'Midnight', bg: 'linear-gradient(135deg,#1e1b4b,#312e81)', preview: '#1e1b4b' },
  { key: 'slate',    label: 'Slate',    bg: 'linear-gradient(135deg,#475569,#64748b)', preview: '#475569' },
  { key: 'gold',     label: 'Gold',     bg: 'linear-gradient(135deg,#ca8a04,#eab308)', preview: '#ca8a04' },
  { key: 'lavender', label: 'Lavender', bg: 'linear-gradient(135deg,#a78bfa,#c4b5fd)', preview: '#a78bfa' },
  { key: 'minimal',  label: 'White',    bg: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', preview: '#f1f5f9' },
];

export interface TextColorOption {
  key: string;
  label: string;
  color: string;
  preview: string;
}

export const TEXT_COLORS: TextColorOption[] = [
  { key: 'white',   label: 'White',   color: '#ffffff', preview: '#ffffff' },
  { key: 'black',   label: 'Black',   color: '#111827', preview: '#111827' },
  { key: 'navy',    label: 'Navy',    color: '#1e3a5f', preview: '#1e3a5f' },
  { key: 'forest',  label: 'Forest',  color: '#14532d', preview: '#14532d' },
  { key: 'crimson', label: 'Crimson', color: '#991b1b', preview: '#991b1b' },
  { key: 'gold',    label: 'Gold',    color: '#ca8a04', preview: '#ca8a04' },
  { key: 'rose',    label: 'Rose',    color: '#f43f5e', preview: '#f43f5e' },
  { key: 'sky',     label: 'Cyan',    color: '#0891b2', preview: '#0891b2' },
];

export function getBubbleStyle(bubbleColorKey: string | null | undefined): React.CSSProperties {
  const preset = BUBBLE_COLORS.find(c => c.key === bubbleColorKey);
  return { background: preset?.bg ?? 'linear-gradient(135deg,#f43f5e,#ec4899)' };
}

export function getTextColorValue(textColorKey: string | null | undefined): string {
  const preset = TEXT_COLORS.find(c => c.key === textColorKey);
  return preset?.color ?? '#ffffff';
}

// ─── Shared popover ──────────────────────────────────────────────────────────
function Popover({
  children,
  onClose,
  alignRight = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  alignRight?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={`absolute bottom-full mb-2 z-[300] ${alignRight ? 'right-0' : 'left-0'}`}
      style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0,0,0,0.09)',
        borderRadius: '16px',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.08)',
        width: '300px',
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── Color swatch row ────────────────────────────────────────────────────────
function ColorSwatchRow({
  colors,
  selected,
  onSelect,
  borderColor = '#f43f5e',
}: {
  colors: { key: string; label: string; bg: string; preview?: string; color?: string }[];
  selected?: string | null;
  onSelect: (key: string) => void;
  borderColor?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {colors.map(c => {
        const bg = c.bg ?? c.color ?? c.preview ?? '#ccc';
        const isSelected = selected === c.key;
        const isLight = c.key === 'white' || c.key === 'minimal' || c.key === 'gold';
        return (
          <button
            key={c.key}
            onClick={() => onSelect(c.key)}
            title={c.label}
            className="relative w-7 h-7 rounded-full transition-transform hover:scale-110"
            style={{
              background: bg,
              boxShadow: isSelected
                ? `0 0 0 2px white, 0 0 0 4px ${borderColor}`
                : '0 1px 3px rgba(0,0,0,0.15)',
              border: isLight ? '1px solid #e2e8f0' : 'none',
            }}
          >
            {isSelected && (
              <Check
                className="absolute inset-0 m-auto w-3 h-3"
                style={{ color: isLight ? '#475569' : 'white' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Font Popover ────────────────────────────────────────────────────────────
function FontPopover({
  currentFontFamily,
  onSelect,
  onClose,
}: {
  currentFontFamily?: string | null;
  onSelect: (fontFamily: string) => void;
  onClose: () => void;
}) {
  const curated = FONT_OPTIONS.filter(
    f => !['comic_sans', 'courier', 'georgia', 'trebuchet', 'impact'].includes(f.key)
  );
  const fun = FONT_OPTIONS.filter(
    f => ['comic_sans', 'courier', 'georgia', 'trebuchet', 'impact'].includes(f.key)
  );

  return (
    <Popover onClose={onClose}>
      <div className="p-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">Font Style</p>
        <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5">
          <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest px-2 py-1">Curated</p>
          {curated.map(f => (
            <button
              key={f.key}
              onClick={() => { onSelect(f.fontFamily); onClose(); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-all duration-100 ${
                currentFontFamily === f.fontFamily
                  ? 'bg-rose-50 border border-rose-200'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <div className="text-left">
                <p className="text-sm font-medium text-gray-800 leading-tight" style={{ fontFamily: f.fontFamily }}>{f.label}</p>
                <p className="text-[10px] text-gray-400 leading-tight" style={{ fontFamily: f.fontFamily }}>{f.sample}</p>
              </div>
              {currentFontFamily === f.fontFamily && <Check className="w-3 h-3 text-rose-500 flex-shrink-0" />}
            </button>
          ))}
          <div className="h-px bg-gray-100 my-1 mx-2" />
          <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest px-2 py-1">Expressive</p>
          {fun.map(f => (
            <button
              key={f.key}
              onClick={() => { onSelect(f.fontFamily); onClose(); }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-all duration-100 ${
                currentFontFamily === f.fontFamily
                  ? 'bg-rose-50 border border-rose-200'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <div className="text-left">
                <p className="text-sm font-medium text-gray-800 leading-tight" style={{ fontFamily: f.fontFamily }}>{f.label}</p>
                <p className="text-[10px] text-gray-400 leading-tight" style={{ fontFamily: f.fontFamily }}>{f.sample}</p>
              </div>
              {currentFontFamily === f.fontFamily && <Check className="w-3 h-3 text-rose-500 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </Popover>
  );
}

// ─── Color Popover ────────────────────────────────────────────────────────────
function ColorPopover({
  currentBubbleColor,
  currentTextColor,
  currentCompanionBubbleColor,
  currentCompanionTextColor,
  companionName,
  onSelectBubble,
  onSelectText,
  onSelectCompanionBubble,
  onSelectCompanionText,
  onClose,
  alignRight = true,
}: {
  currentBubbleColor?: string | null;
  currentTextColor?: string | null;
  currentCompanionBubbleColor?: string | null;
  currentCompanionTextColor?: string | null;
  companionName?: string;
  onSelectBubble: (key: string) => void;
  onSelectText: (key: string) => void;
  onSelectCompanionBubble: (key: string) => void;
  onSelectCompanionText: (key: string) => void;
  onClose: () => void;
  alignRight?: boolean;
}) {
  const [tab, setTab] = useState<'you' | 'companion'>('you');

  const activeBubble = BUBBLE_COLORS.find(c => c.key === currentBubbleColor) ?? BUBBLE_COLORS[0];
  const activeText = TEXT_COLORS.find(c => c.key === currentTextColor) ?? TEXT_COLORS[0];
  const activeCompBubble = BUBBLE_COLORS.find(c => c.key === currentCompanionBubbleColor);
  const activeCompText = TEXT_COLORS.find(c => c.key === currentCompanionTextColor) ?? TEXT_COLORS[1];

  return (
    <Popover onClose={onClose} alignRight={alignRight}>
      <div className="p-3">
        <div className="flex gap-0.5 bg-gray-100/80 rounded-lg p-0.5 mb-3">
          <button
            onClick={() => setTab('you')}
            className={`flex-1 py-1 rounded-md text-[10px] font-semibold transition-all ${
              tab === 'you' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Your Messages
          </button>
          <button
            onClick={() => setTab('companion')}
            className={`flex-1 py-1 rounded-md text-[10px] font-semibold transition-all ${
              tab === 'companion' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {companionName ?? 'Companion'}
          </button>
        </div>

        {tab === 'you' && (
          <>
            <div className="flex justify-end mb-3">
              <div
                className="px-4 py-2 rounded-2xl rounded-br-sm text-sm font-medium shadow-md max-w-[80%]"
                style={{ background: activeBubble.bg, color: activeText.color }}
              >
                Hello, how are you?
              </div>
            </div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 px-1">Bubble Color</p>
            <ColorSwatchRow colors={BUBBLE_COLORS} selected={currentBubbleColor} onSelect={onSelectBubble} />
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-3 mb-1.5 px-1">Text Color</p>
            <ColorSwatchRow colors={TEXT_COLORS.map(c => ({ ...c, bg: c.color }))} selected={currentTextColor} onSelect={onSelectText} />
          </>
        )}

        {tab === 'companion' && (
          <>
            <div className="flex justify-start mb-3">
              <div
                className="px-4 py-2 rounded-2xl rounded-bl-sm text-sm font-medium shadow-md max-w-[80%] border"
                style={
                  activeCompBubble
                    ? { background: activeCompBubble.bg, color: activeCompText.color, borderColor: 'transparent' }
                    : { background: 'white', color: activeCompText.color, borderColor: '#e5e7eb' }
                }
              >
                {companionName ? `Hey, it's ${companionName}!` : 'Hey there!'}
              </div>
            </div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 px-1">Bubble Color</p>
            <ColorSwatchRow colors={BUBBLE_COLORS} selected={currentCompanionBubbleColor} onSelect={onSelectCompanionBubble} borderColor="#0ea5e9" />
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-3 mb-1.5 px-1">Text Color</p>
            <ColorSwatchRow colors={TEXT_COLORS.map(c => ({ ...c, bg: c.color }))} selected={currentCompanionTextColor} onSelect={onSelectCompanionText} borderColor="#0ea5e9" />
          </>
        )}
      </div>
    </Popover>
  );
}

// ─── Mouse Popover ────────────────────────────────────────────────────────────
function MousePopover({
  customization,
  onUpdate,
  onClose,
  alignRight = true,
}: {
  customization: UserCustomization;
  onUpdate: (prefs: Partial<UserCustomization>) => void;
  onClose: () => void;
  alignRight?: boolean;
}) {
  const save = useCallback((prefs: Partial<UserCustomization>) => {
    onUpdate(prefs);
  }, [onUpdate]);

  return (
    <Popover onClose={onClose} alignRight={alignRight}>
      <div className="p-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">Mouse Effects</p>

        <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest px-1 mb-1">Animation</p>
        <div className="grid grid-cols-5 gap-1 mb-3">
          {ANIMATION_STYLES.map(a => (
            <button
              key={a.key}
              onClick={() => save({ animation_style: a.key })}
              title={a.description}
              className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-xl transition-all duration-100 ${
                customization.animation_style === a.key
                  ? 'bg-rose-50 border border-rose-200'
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className={`w-4 h-4 ${customization.animation_style === a.key ? 'text-rose-500' : 'text-gray-400'}`}
                fill="currentColor"
                stroke="none"
              >
                <path d={a.icon} />
              </svg>
              <span className={`text-[9px] font-medium leading-none ${customization.animation_style === a.key ? 'text-rose-600' : 'text-gray-400'}`}>
                {a.label}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between px-1 mb-2">
          <div>
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Mouse Trail</p>
            <p className="text-[10px] text-gray-500">{customization.show_trail ? 'On' : 'Off'}</p>
          </div>
          <button onClick={() => save({ show_trail: !customization.show_trail })} className="flex items-center">
            {customization.show_trail
              ? <ToggleRight className="w-8 h-8 text-rose-500" />
              : <ToggleLeft className="w-8 h-8 text-gray-300" />
            }
          </button>
        </div>

        {customization.show_trail && (
          <div className="grid grid-cols-3 gap-1">
            {TRAIL_STYLES.map(t => (
              <button
                key={t.key}
                onClick={() => save({ trail_style: t.key })}
                className={`px-2 py-1.5 rounded-xl text-[10px] font-semibold transition-all duration-100 ${
                  customization.trail_style === t.key
                    ? 'bg-rose-50 border border-rose-200 text-rose-600'
                    : 'hover:bg-gray-50 border border-transparent text-gray-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </Popover>
  );
}

// ─── Shared props ─────────────────────────────────────────────────────────────
export interface ChatStyleBarProps {
  companionId?: string | null;
  companionName?: string;
  currentFontFamily?: string | null;
  currentBubbleColor?: string | null;
  currentTextColor?: string | null;
  currentCompanionBubbleColor?: string | null;
  currentCompanionTextColor?: string | null;
  customization?: UserCustomization | null;
  onFontChange?: (fontFamily: string) => void;
  onBubbleColorChange?: (key: string) => void;
  onTextColorChange?: (key: string) => void;
  onCompanionBubbleColorChange?: (key: string) => void;
  onCompanionTextColorChange?: (key: string) => void;
  onCustomizationUpdate?: (prefs: Partial<UserCustomization>) => void;
  onOpenWallpaper?: () => void;
}

type ActivePanel = 'font' | 'color' | 'mouse' | null;

// ─── Horizontal tile strip (desktop, below input) ────────────────────────────
export function ChatStyleTileStrip(props: ChatStyleBarProps) {
  const {
    companionId, companionName,
    currentFontFamily, currentBubbleColor, currentTextColor,
    currentCompanionBubbleColor, currentCompanionTextColor,
    customization, onFontChange, onBubbleColorChange, onTextColorChange,
    onCompanionBubbleColorChange, onCompanionTextColorChange,
    onCustomizationUpdate, onOpenWallpaper,
  } = props;

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const toggle = (panel: ActivePanel) => setActivePanel(prev => prev === panel ? null : panel);

  const handleFontSelect = async (fontFamily: string) => {
    onFontChange?.(fontFamily);
    if (companionId) await updateCompanionChatStyle(companionId, { font_family: fontFamily });
  };
  const handleBubbleSelect = async (key: string) => {
    onBubbleColorChange?.(key);
    if (companionId) await updateCompanionChatStyle(companionId, { chat_bubble_color: key });
  };
  const handleTextSelect = async (key: string) => {
    onTextColorChange?.(key);
    if (companionId) await updateCompanionChatStyle(companionId, { chat_text_color: key });
  };
  const handleCompanionBubbleSelect = async (key: string) => {
    onCompanionBubbleColorChange?.(key);
    if (companionId) await updateCompanionChatStyle(companionId, { companion_bubble_color: key });
  };
  const handleCompanionTextSelect = async (key: string) => {
    onCompanionTextColorChange?.(key);
    if (companionId) await updateCompanionChatStyle(companionId, { companion_text_color: key });
  };

  const hasCustomFont = !!currentFontFamily;
  const hasCustomColor =
    (!!currentBubbleColor && currentBubbleColor !== 'rose') ||
    !!currentTextColor || !!currentCompanionBubbleColor || !!currentCompanionTextColor;
  const hasCustomMouse =
    customization && (customization.show_trail || customization.animation_style !== 'none');
  const activeBubblePreview = BUBBLE_COLORS.find(c => c.key === currentBubbleColor)?.preview;

  const TILES: {
    id: ActivePanel | 'wallpaper';
    icon: React.ReactNode;
    label: string;
    sub: string;
    dot?: string;
    color: string;
    iconBg: string;
  }[] = [
    { id: 'wallpaper', icon: <Image className="w-4 h-4" />, label: 'Wallpaper', sub: 'Chat background', color: 'text-teal-600', iconBg: 'bg-teal-50' },
    { id: 'font',      icon: <Type className="w-4 h-4" />,    label: 'Font',      sub: 'Message typeface', dot: hasCustomFont ? 'bg-rose-400' : undefined, color: 'text-rose-600', iconBg: 'bg-rose-50' },
    { id: 'color',     icon: <Palette className="w-4 h-4" />, label: 'Colors',    sub: 'Bubbles & text',  dot: hasCustomColor ? (activeBubblePreview ?? '#f43f5e') : undefined, color: 'text-sky-600', iconBg: 'bg-sky-50' },
    { id: 'mouse',     icon: <Sparkles className="w-4 h-4" />,label: 'Effects',   sub: 'Cursor & trails', dot: hasCustomMouse ? 'bg-amber-400' : undefined, color: 'text-amber-600', iconBg: 'bg-amber-50' },
  ];

  return (
    <div className="flex gap-1.5 w-full relative">
      {TILES.map((tile, i) => {
        const isActive = activePanel === tile.id;
        // last two tiles get popover right-aligned so they don't overflow
        const popoverRight = i >= 2;
        return (
          <div key={tile.id} className="relative flex-1 min-w-0">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (tile.id === 'wallpaper') {
                  onOpenWallpaper?.();
                  setActivePanel(null);
                } else {
                  toggle(tile.id as ActivePanel);
                }
              }}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-100 ${
                isActive
                  ? 'bg-white border-gray-200 shadow-sm'
                  : 'border-gray-100 bg-white/60 hover:bg-white hover:border-gray-200 hover:shadow-sm'
              }`}
              style={{ boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.08)' : undefined }}
            >
              <span className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 ${tile.color} ${tile.iconBg}`}>
                {tile.icon}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[11px] font-semibold text-gray-700 leading-tight truncate">{tile.label}</span>
                <span className="block text-[9px] text-gray-400 leading-tight truncate">{tile.sub}</span>
              </span>
              {tile.dot && (
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${typeof tile.dot === 'string' && tile.dot.startsWith('bg-') ? tile.dot : ''}`}
                  style={typeof tile.dot === 'string' && !tile.dot.startsWith('bg-') ? { background: tile.dot } : {}}
                />
              )}
            </motion.button>

            <AnimatePresence>
              {activePanel === tile.id && tile.id === 'font' && (
                <FontPopover
                  currentFontFamily={currentFontFamily}
                  onSelect={handleFontSelect}
                  onClose={() => setActivePanel(null)}
                />
              )}
              {activePanel === tile.id && tile.id === 'color' && (
                <ColorPopover
                  currentBubbleColor={currentBubbleColor}
                  currentTextColor={currentTextColor}
                  currentCompanionBubbleColor={currentCompanionBubbleColor}
                  currentCompanionTextColor={currentCompanionTextColor}
                  companionName={companionName}
                  onSelectBubble={handleBubbleSelect}
                  onSelectText={handleTextSelect}
                  onSelectCompanionBubble={handleCompanionBubbleSelect}
                  onSelectCompanionText={handleCompanionTextSelect}
                  onClose={() => setActivePanel(null)}
                  alignRight={popoverRight}
                />
              )}
              {activePanel === tile.id && tile.id === 'mouse' && customization && (
                <MousePopover
                  customization={customization}
                  onUpdate={prefs => onCustomizationUpdate?.(prefs)}
                  onClose={() => setActivePanel(null)}
                  alignRight={popoverRight}
                />
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ─── Compact icon bar (mobile) ────────────────────────────────────────────────
const BTN = `
  flex items-center justify-center w-8 h-8 rounded-xl border transition-all duration-150 flex-shrink-0
`;

export function ChatStyleBar(props: ChatStyleBarProps) {
  const {
    companionId, companionName,
    currentFontFamily, currentBubbleColor, currentTextColor,
    currentCompanionBubbleColor, currentCompanionTextColor,
    customization, onFontChange, onBubbleColorChange, onTextColorChange,
    onCompanionBubbleColorChange, onCompanionTextColorChange,
    onCustomizationUpdate, onOpenWallpaper,
  } = props;

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const toggle = (panel: ActivePanel) => setActivePanel(prev => prev === panel ? null : panel);

  const handleFontSelect = async (fontFamily: string) => {
    onFontChange?.(fontFamily);
    if (companionId) await updateCompanionChatStyle(companionId, { font_family: fontFamily });
  };
  const handleBubbleSelect = async (key: string) => {
    onBubbleColorChange?.(key);
    if (companionId) await updateCompanionChatStyle(companionId, { chat_bubble_color: key });
  };
  const handleTextSelect = async (key: string) => {
    onTextColorChange?.(key);
    if (companionId) await updateCompanionChatStyle(companionId, { chat_text_color: key });
  };
  const handleCompanionBubbleSelect = async (key: string) => {
    onCompanionBubbleColorChange?.(key);
    if (companionId) await updateCompanionChatStyle(companionId, { companion_bubble_color: key });
  };
  const handleCompanionTextSelect = async (key: string) => {
    onCompanionTextColorChange?.(key);
    if (companionId) await updateCompanionChatStyle(companionId, { companion_text_color: key });
  };

  const hasCustomFont = !!currentFontFamily;
  const hasCustomColor =
    (!!currentBubbleColor && currentBubbleColor !== 'rose') ||
    !!currentTextColor || !!currentCompanionBubbleColor || !!currentCompanionTextColor;
  const hasCustomMouse =
    customization && (customization.show_trail || customization.animation_style !== 'none');
  const activeBubblePreview = BUBBLE_COLORS.find(c => c.key === currentBubbleColor)?.preview;

  const iconClass = (active: boolean) =>
    `${BTN} ${
      active
        ? 'bg-rose-50 border-rose-200 text-rose-600'
        : 'bg-white/90 border-gray-200/80 text-gray-500 hover:border-gray-300 hover:text-gray-700'
    }`;

  return (
    <div className="flex items-center gap-1 relative">
      {onOpenWallpaper && (
        <button
          onClick={onOpenWallpaper}
          title="Chat wallpaper"
          className={`${BTN} bg-white/90 border-gray-200/80 text-gray-500 hover:border-teal-300 hover:text-teal-600`}
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}
        >
          <Image size={14} />
        </button>
      )}

      <div className="relative">
        <button
          onClick={() => toggle('font')}
          title="Change font"
          className={iconClass(activePanel === 'font')}
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}
        >
          <Type size={14} />
          {hasCustomFont && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-400 border border-white" />
          )}
        </button>
        <AnimatePresence>
          {activePanel === 'font' && (
            <FontPopover currentFontFamily={currentFontFamily} onSelect={handleFontSelect} onClose={() => setActivePanel(null)} />
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        <button
          onClick={() => toggle('color')}
          title="Bubble & text color"
          className={iconClass(activePanel === 'color')}
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}
        >
          <Palette size={14} />
          {hasCustomColor && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white"
              style={{ background: activeBubblePreview ?? '#f43f5e' }}
            />
          )}
        </button>
        <AnimatePresence>
          {activePanel === 'color' && (
            <ColorPopover
              currentBubbleColor={currentBubbleColor}
              currentTextColor={currentTextColor}
              currentCompanionBubbleColor={currentCompanionBubbleColor}
              currentCompanionTextColor={currentCompanionTextColor}
              companionName={companionName}
              onSelectBubble={handleBubbleSelect}
              onSelectText={handleTextSelect}
              onSelectCompanionBubble={handleCompanionBubbleSelect}
              onSelectCompanionText={handleCompanionTextSelect}
              onClose={() => setActivePanel(null)}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        <button
          onClick={() => toggle('mouse')}
          title="Mouse effects"
          className={iconClass(activePanel === 'mouse')}
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}
        >
          <Sparkles size={14} />
          {hasCustomMouse && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 border border-white" />
          )}
        </button>
        <AnimatePresence>
          {activePanel === 'mouse' && customization && (
            <MousePopover
              customization={customization}
              onUpdate={prefs => onCustomizationUpdate?.(prefs)}
              onClose={() => setActivePanel(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
