import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Image as ImageIcon, Type, Palette,
  Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { updateCompanionChatStyle } from '../services/companionService';
import {
  CSS_WALLPAPER_PRESETS,
  PHOTO_WALLPAPER_PRESETS,
  LIVE_WALLPAPER_PRESETS,
  ALL_PRESETS,
  buildWallpaperMeta,
} from '../services/wallpaperService';
import {
  BUBBLE_COLORS,
  TEXT_COLORS,
  getBubbleStyle,
  getTextColorValue,
} from '../components/ChatStyleBar';
import { getEligibleFonts } from '../services/customizationService';
import { VELVET_THEME } from '../config/velvetTheme';

type Tab = 'presets' | 'wallpaper' | 'font' | 'colors';
type ColorTab = 'you' | 'companion';

interface Preset {
  id: string;
  label: string;
  wallpaperId: string;
  fontFamily: string;
  bubbleColor: string;
  textColor: string;
  companionBubbleColor: string;
  companionTextColor: string;
}

const PRESETS: Preset[] = [
  {
    id: 'late-night',
    label: 'Late Night',
    wallpaperId: 'midnight-city',
    fontFamily: "'Oswald', sans-serif",
    bubbleColor: 'midnight',
    textColor: 'white',
    companionBubbleColor: 'slate',
    companionTextColor: 'white',
  },
  {
    id: 'warm-glow',
    label: 'Warm Glow',
    wallpaperId: 'sunset-dusk',
    fontFamily: "'Lora', serif",
    bubbleColor: 'coral',
    textColor: 'white',
    companionBubbleColor: 'minimal',
    companionTextColor: 'crimson',
  },
  {
    id: 'clean-slate',
    label: 'Clean Slate',
    wallpaperId: 'obsidian',
    fontFamily: "'Nunito', sans-serif",
    bubbleColor: 'minimal',
    textColor: 'navy',
    companionBubbleColor: 'slate',
    companionTextColor: 'white',
  },
  {
    id: 'ocean-breeze',
    label: 'Ocean Breeze',
    wallpaperId: 'arctic-ice',
    fontFamily: "'Barlow', sans-serif",
    bubbleColor: 'sky',
    textColor: 'white',
    companionBubbleColor: 'minimal',
    companionTextColor: 'navy',
  },
  {
    id: 'rose-romance',
    label: 'Rose Romance',
    wallpaperId: 'rose-garden',
    fontFamily: "'Cormorant Garamond', serif",
    bubbleColor: 'rose',
    textColor: 'white',
    companionBubbleColor: 'lavender',
    companionTextColor: 'navy',
  },
];

export function EnvironmentSetupPage() {
  const navigate = useNavigate();

  const [companionId, setCompanionId] = useState<string | null>(null);
  const [companionName, setCompanionName] = useState('Companion');
  const [companionGender, setCompanionGender] = useState<'male' | 'female'>('female');
  const [nextRoute, setNextRoute] = useState<string>('/lobby');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>('presets');
  const [showCustomize, setShowCustomize] = useState(false);
  const [colorTab, setColorTab] = useState<ColorTab>('you');

  const [wallpaperId, setWallpaperId] = useState<string | null>(null);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  const [bubbleColor, setBubbleColor] = useState<string | null>('rose');
  const [textColor, setTextColor] = useState<string | null>('white');
  const [companionBubbleColor, setCompanionBubbleColor] = useState<string | null>(null);
  const [companionTextColor, setCompanionTextColor] = useState<string | null>('black');

  const eligibleFonts = useMemo(
    () => getEligibleFonts(companionGender).filter(
      f => !['comic_sans', 'courier', 'georgia', 'trebuchet', 'impact'].includes(f.key)
    ),
    [companionGender]
  );

  useEffect(() => {
    const id = sessionStorage.getItem('currentCompanionId') || sessionStorage.getItem('atlasCoachId');
    const storedNext = sessionStorage.getItem('envSetupNextRoute') || '/lobby';
    const name = sessionStorage.getItem('atlasCoachName') || 'Companion';
    const gender = (sessionStorage.getItem('atlasCoachGender') as 'male' | 'female') || 'female';

    if (id) {
      setCompanionId(id);
      (async () => {
        const { data } = await supabase
          .from('companions')
          .select('custom_name, gender, chat_wallpaper, chat_wallpaper_url, font_family, chat_bubble_color, chat_text_color, companion_bubble_color, companion_text_color')
          .eq('id', id)
          .maybeSingle();

        if (data) {
          setCompanionName(data.custom_name || name);
          setCompanionGender(data.gender || gender);
          if (data.font_family) setFontFamily(data.font_family);
          if (data.chat_bubble_color) setBubbleColor(data.chat_bubble_color);
          if (data.chat_text_color) setTextColor(data.chat_text_color);
          if (data.companion_bubble_color) setCompanionBubbleColor(data.companion_bubble_color);
          if (data.companion_text_color) setCompanionTextColor(data.companion_text_color);
          if (data.chat_wallpaper) setWallpaperId(data.chat_wallpaper);
          if (data.chat_wallpaper_url) setWallpaperUrl(data.chat_wallpaper_url);
        }
        setNextRoute(storedNext);
        setLoading(false);
      })();
    } else {
      setNextRoute(storedNext);
      setLoading(false);
    }
  }, []);

  const wallpaperMeta = useMemo(
    () => buildWallpaperMeta(wallpaperId, wallpaperUrl),
    [wallpaperId, wallpaperUrl]
  );

  const previewStyle: React.CSSProperties = useMemo(
    () => ({
      ...wallpaperMeta.style,
      fontFamily: fontFamily ?? undefined,
    }),
    [wallpaperMeta, fontFamily]
  );

  const previewClassName = wallpaperMeta.className;

  const applyPreset = useCallback((p: Preset) => {
    setWallpaperId(p.wallpaperId);
    setWallpaperUrl(null);
    setFontFamily(p.fontFamily);
    setBubbleColor(p.bubbleColor);
    setTextColor(p.textColor);
    setCompanionBubbleColor(p.companionBubbleColor);
    setCompanionTextColor(p.companionTextColor);
  }, []);

  const handleSave = async () => {
    if (!companionId) {
      navigate(nextRoute);
      return;
    }

    setSaving(true);
    try {
      await updateCompanionChatStyle(companionId, {
        chat_wallpaper: wallpaperId,
        chat_wallpaper_url: wallpaperUrl,
        font_family: fontFamily,
        chat_bubble_color: bubbleColor,
        chat_text_color: textColor,
        companion_bubble_color: companionBubbleColor,
        companion_text_color: companionTextColor,
      });
    } catch (e) {
      console.error('Error saving environment preferences:', e);
    } finally {
      setSaving(false);
      sessionStorage.removeItem('envSetupNextRoute');
      navigate(nextRoute);
    }
  };

  const handleSkip = () => {
    sessionStorage.removeItem('envSetupNextRoute');
    navigate(nextRoute);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: VELVET_THEME.bg }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-400" />
      </div>
    );
  }

  const TABS: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'presets',   icon: <Sparkles className="w-4 h-4" />, label: 'Presets' },
    { id: 'wallpaper', icon: <ImageIcon className="w-4 h-4" />, label: 'Wallpaper' },
    { id: 'font',      icon: <Type className="w-4 h-4" />,    label: 'Font' },
    { id: 'colors',    icon: <Palette className="w-4 h-4" />, label: 'Colors' },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: VELVET_THEME.bg }}>
      <div className="max-w-3xl mx-auto w-full px-5 py-8 flex-1 flex flex-col">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="flex justify-center mb-4">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl"
              style={{ background: VELVET_THEME.colors.glassCard, border: `1px solid ${VELVET_THEME.colors.glassBorder}` }}
            >
              <Palette className="w-7 h-7 text-rose-300" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
            Make It Yours
          </h1>
          <p className="text-base text-ink-secondary max-w-lg mx-auto">
            Pick the look of your chat with {companionName}. Try a preset, customize every detail, or skip and style it later.
          </p>
        </motion.div>

        {/* Live Chat Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl overflow-hidden mb-6 relative"
          style={{
            border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
            minHeight: '240px',
          }}
        >
          <div
            className={`relative px-5 py-6 flex flex-col gap-3 ${previewClassName}`}
            style={{
              ...previewStyle,
              minHeight: '240px',
            }}
          >
            {/* Companion message */}
            <div className="flex justify-start">
              <div
                className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm shadow-md max-w-[80%] border"
                style={{
                  ...(companionBubbleColor
                    ? { ...getBubbleStyle(companionBubbleColor), borderColor: 'transparent' }
                    : { background: 'rgba(255,255,255,0.92)', borderColor: 'rgba(0,0,0,0.06)' }),
                  color: getTextColorValue(companionTextColor),
                  fontFamily: fontFamily ?? undefined,
                }}
              >
                Hey, it's {companionName}! I'm so glad we're doing this.
              </div>
            </div>

            {/* User message */}
            <div className="flex justify-end">
              <div
                className="px-4 py-2.5 rounded-2xl rounded-br-sm text-sm shadow-md max-w-[80%]"
                style={{
                  ...getBubbleStyle(bubbleColor),
                  color: getTextColorValue(textColor),
                  fontFamily: fontFamily ?? undefined,
                }}
              >
                I love how this looks already!
              </div>
            </div>

            {/* Companion message 2 */}
            <div className="flex justify-start">
              <div
                className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm shadow-md max-w-[80%] border"
                style={{
                  ...(companionBubbleColor
                    ? { ...getBubbleStyle(companionBubbleColor), borderColor: 'transparent' }
                    : { background: 'rgba(255,255,255,0.92)', borderColor: 'rgba(0,0,0,0.06)' }),
                  color: getTextColorValue(companionTextColor),
                  fontFamily: fontFamily ?? undefined,
                }}
              >
                We can change it anytime. This is your space.
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tab Bar */}
        <div className="flex gap-1.5 mb-5">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== 'presets') setShowCustomize(true);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(244,63,94,0.18), rgba(244,114,182,0.12))'
                    : VELVET_THEME.colors.glassCard,
                  border: `1px solid ${isActive ? 'rgba(244,63,94,0.35)' : VELVET_THEME.colors.glassBorder}`,
                  color: isActive ? '#f9a8d4' : 'var(--ds-text-secondary, #94a3b8)',
                }}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div
          className="rounded-2xl p-5 mb-6 flex-1"
          style={{ background: VELVET_THEME.colors.glassCard, border: `1px solid ${VELVET_THEME.colors.glassBorder}` }}
        >
          <AnimatePresence mode="wait">
            {/* Presets */}
            {activeTab === 'presets' && (
              <motion.div
                key="presets"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted mb-3">
                  One-Tap Looks
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PRESETS.map(p => {
                    const presetWallpaper = ALL_PRESETS.find(w => w.id === p.wallpaperId);
                    const isSelected =
                      wallpaperId === p.wallpaperId &&
                      fontFamily === p.fontFamily &&
                      bubbleColor === p.bubbleColor;
                    return (
                      <button
                        key={p.id}
                        onClick={() => applyPreset(p)}
                        className="relative rounded-xl overflow-hidden transition-all hover:scale-[1.03]"
                        style={{
                          border: isSelected
                            ? '2px solid rgba(244,63,94,0.6)'
                            : `1px solid ${VELVET_THEME.colors.glassBorder}`,
                          boxShadow: isSelected ? '0 0 20px rgba(244,63,94,0.2)' : 'none',
                        }}
                      >
                        <div
                          className="h-20 flex items-center justify-center"
                          style={presetWallpaper?.cssStyle ?? presetWallpaper?.thumbnailStyle}
                        >
                          <div className="flex gap-1.5">
                            <div
                              className="w-6 h-6 rounded-lg"
                              style={getBubbleStyle(p.bubbleColor)}
                            />
                            <div
                              className="w-6 h-6 rounded-lg"
                              style={
                                p.companionBubbleColor
                                  ? getBubbleStyle(p.companionBubbleColor)
                                  : { background: 'rgba(255,255,255,0.85)' }
                              }
                            />
                          </div>
                        </div>
                        <div
                          className="px-3 py-2 flex items-center justify-between"
                          style={{ background: VELVET_THEME.colors.glassCard }}
                        >
                          <span
                            className="text-sm font-medium"
                            style={{ fontFamily: p.fontFamily, color: 'var(--ds-text-secondary, #cbd5e1)' }}
                          >
                            {p.label}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-rose-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Customize toggle */}
                <button
                  onClick={() => setShowCustomize(!showCustomize)}
                  className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: showCustomize ? 'rgba(244,63,94,0.1)' : VELVET_THEME.colors.glassCard,
                    border: `1px solid ${showCustomize ? 'rgba(244,63,94,0.3)' : VELVET_THEME.colors.glassBorder}`,
                    color: showCustomize ? '#f9a8d4' : 'var(--ds-text-secondary, #94a3b8)',
                  }}
                >
                  {showCustomize ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showCustomize ? 'Hide custom options' : 'Customize each detail'}
                </button>

                {showCustomize && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 flex gap-2"
                  >
                    {TABS.filter(t => t.id !== 'presets').map(t => (
                      <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: VELVET_THEME.colors.glassCard,
                          border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
                          color: 'var(--ds-text-secondary, #94a3b8)',
                        }}
                      >
                        {t.icon}
                        {t.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Wallpaper */}
            {activeTab === 'wallpaper' && (
              <motion.div
                key="wallpaper"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted mb-3">
                  Gradient Wallpapers
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 mb-4">
                  {CSS_WALLPAPER_PRESETS.map(w => (
                    <WallpaperThumb
                      key={w.id}
                      label={w.name}
                      isSelected={wallpaperId === w.id}
                      onClick={() => { setWallpaperId(w.id); setWallpaperUrl(null); }}
                      style={w.cssStyle}
                    />
                  ))}
                </div>

                <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted mb-3">
                  Photo Wallpapers
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 mb-4">
                  {PHOTO_WALLPAPER_PRESETS.map(w => (
                    <WallpaperThumb
                      key={w.id}
                      label={w.name}
                      isSelected={wallpaperId === w.id}
                      onClick={() => { setWallpaperId(w.id); setWallpaperUrl(null); }}
                      style={{ backgroundImage: `url(${w.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    />
                  ))}
                </div>

                <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted mb-3">
                  Animated Wallpapers
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                  {LIVE_WALLPAPER_PRESETS.map(w => (
                    <WallpaperThumb
                      key={w.id}
                      label={w.name}
                      isSelected={wallpaperId === w.id}
                      onClick={() => { setWallpaperId(w.id); setWallpaperUrl(null); }}
                      style={w.thumbnailStyle}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Font */}
            {activeTab === 'font' && (
              <motion.div
                key="font"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted mb-3">
                  Message Typeface
                </p>
                <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                  {eligibleFonts.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFontFamily(f.fontFamily)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                      style={{
                        background: fontFamily === f.fontFamily
                          ? 'rgba(244,63,94,0.12)'
                          : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${fontFamily === f.fontFamily ? 'rgba(244,63,94,0.3)' : 'transparent'}`,
                      }}
                    >
                      <div className="text-left">
                        <p
                          className="text-base font-medium leading-tight"
                          style={{ fontFamily: f.fontFamily, color: 'var(--ds-text-primary, #e2e8f0)' }}
                        >
                          {f.label}
                        </p>
                        <p
                          className="text-xs leading-tight"
                          style={{ fontFamily: f.fontFamily, color: 'var(--ds-text-muted, #64748b)' }}
                        >
                          {f.sample}
                        </p>
                      </div>
                      {fontFamily === f.fontFamily && <Check className="w-4 h-4 text-rose-400 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Colors */}
            {activeTab === 'colors' && (
              <motion.div
                key="colors"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex gap-0.5 rounded-lg p-0.5 mb-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <button
                    onClick={() => setColorTab('you')}
                    className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
                    style={{
                      background: colorTab === 'you' ? VELVET_THEME.colors.glassCard : 'transparent',
                      color: colorTab === 'you' ? '#f9a8d4' : 'var(--ds-text-muted, #64748b)',
                    }}
                  >
                    Your Messages
                  </button>
                  <button
                    onClick={() => setColorTab('companion')}
                    className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
                    style={{
                      background: colorTab === 'companion' ? VELVET_THEME.colors.glassCard : 'transparent',
                      color: colorTab === 'companion' ? '#f9a8d4' : 'var(--ds-text-muted, #64748b)',
                    }}
                  >
                    {companionName}
                  </button>
                </div>

                {colorTab === 'you' && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted mb-2">Bubble Color</p>
                    <ColorRow
                      colors={BUBBLE_COLORS}
                      selected={bubbleColor}
                      onSelect={setBubbleColor}
                    />
                    <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted mt-4 mb-2">Text Color</p>
                    <ColorRow
                      colors={TEXT_COLORS.map(c => ({ ...c, bg: c.color }))}
                      selected={textColor}
                      onSelect={setTextColor}
                    />
                  </>
                )}

                {colorTab === 'companion' && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted mb-2">Bubble Color</p>
                    <ColorRow
                      colors={BUBBLE_COLORS}
                      selected={companionBubbleColor}
                      onSelect={setCompanionBubbleColor}
                      accentColor="#0ea5e9"
                    />
                    <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted mt-4 mb-2">Text Color</p>
                    <ColorRow
                      colors={TEXT_COLORS.map(c => ({ ...c, bg: c.color }))}
                      selected={companionTextColor}
                      onSelect={setCompanionTextColor}
                      accentColor="#0ea5e9"
                    />
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            disabled={saving}
            className="flex-1 py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50"
            style={{
              background: VELVET_THEME.colors.glassCard,
              border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
              color: 'var(--ds-text-secondary, #94a3b8)',
            }}
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3.5 rounded-xl font-semibold transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
              boxShadow: '0 2px 12px rgba(244,63,94,0.25)',
              color: '#fff',
            }}
          >
            {saving ? 'Saving...' : 'Done'}
            {!saving && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Wallpaper thumbnail ─────────────────────────────────────────────────────
function WallpaperThumb({
  label,
  isSelected,
  onClick,
  style,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-xl overflow-hidden transition-all hover:scale-[1.05]"
      style={{
        border: isSelected
          ? '2px solid rgba(244,63,94,0.6)'
          : `1px solid ${VELVET_THEME.colors.glassBorder}`,
        boxShadow: isSelected ? '0 0 16px rgba(244,63,94,0.25)' : 'none',
      }}
    >
      <div className="h-16 w-full" style={style}>
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Check className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
      <div
        className="px-1.5 py-1 text-[10px] font-medium truncate text-center"
        style={{ background: 'rgba(0,0,0,0.4)', color: '#cbd5e1' }}
      >
        {label}
      </div>
    </button>
  );
}

// ─── Color swatch row ────────────────────────────────────────────────────────
function ColorRow({
  colors,
  selected,
  onSelect,
  accentColor = '#f43f5e',
}: {
  colors: { key: string; label: string; bg: string; preview?: string; color?: string }[];
  selected?: string | null;
  onSelect: (key: string) => void;
  accentColor?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(c => {
        const bg = c.bg ?? c.color ?? c.preview ?? '#ccc';
        const isSelected = selected === c.key;
        const isLight = c.key === 'white' || c.key === 'minimal' || c.key === 'gold';
        return (
          <button
            key={c.key}
            onClick={() => onSelect(c.key)}
            title={c.label}
            className="relative w-9 h-9 rounded-full transition-transform hover:scale-110"
            style={{
              background: bg,
              boxShadow: isSelected
                ? `0 0 0 2px white, 0 0 0 4px ${accentColor}`
                : '0 1px 4px rgba(0,0,0,0.25)',
              border: isLight ? '1px solid rgba(255,255,255,0.2)' : 'none',
            }}
          >
            {isSelected && (
              <Check
                className="absolute inset-0 m-auto w-4 h-4"
                style={{ color: isLight ? '#475569' : 'white' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
