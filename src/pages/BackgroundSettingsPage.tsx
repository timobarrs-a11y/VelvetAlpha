import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Upload, Sparkles, Check, ImageIcon, Palette, Loader2, AlertCircle, Lock, Zap, X, Type } from 'lucide-react';
import {
  CSS_WALLPAPER_PRESETS,
  PHOTO_WALLPAPER_PRESETS,
  LIVE_WALLPAPER_PRESETS,
  buildWallpaperMeta,
  saveWorkspaceWallpaper,
  uploadWorkspaceWallpaperImage,
  generateAIWallpaper,
  WallpaperPreset,
} from '../services/wallpaperService';
import { useCustomization } from '../hooks/useCustomization';
import { useAuth } from '../auth/AuthProvider';
import { SubscriptionTier } from '../types/subscription';
import { ALL_PRESETS } from '../services/wallpaperService';
import { TOOLBAR_TEXT_COLOR_PRESETS, type ToolbarTextColorKey } from '../services/customizationService';

type Tab = 'live' | 'gradient' | 'photo' | 'upload' | 'ai';

const PRO_TIERS: SubscriptionTier[] = ['plus', 'elite', 'trial'];

function isProTier(tier: SubscriptionTier): boolean {
  return PRO_TIERS.includes(tier);
}

const AI_PROMPT_SUGGESTIONS = [
  `a cozy rainy night coffee shop`,
  `a cherry blossom park in spring`,
  `a neon-lit cyberpunk city street`,
  `a peaceful mountain lake at dawn`,
  `a luxurious art deco hotel lobby`,
  `a dreamy galaxy with colorful nebulae`,
];

export function BackgroundSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { customization, setWorkspaceWallpaper, setToolbarTextColor } = useCustomization();

  const userId = user?.id ?? '';
  const currentWallpaper = customization?.workspace_wallpaper_id ?? null;
  const currentWallpaperUrl = customization?.workspace_wallpaper_url ?? null;
  const userTier: SubscriptionTier = (user?.app_metadata?.tier as SubscriptionTier) ?? 'free';
  const isPro = isProTier(userTier);

  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [selected, setSelected] = useState<string | null>(currentWallpaper);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(currentWallpaperUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [textColor, setTextColor] = useState<ToolbarTextColorKey>(customization?.toolbar_text_color ?? 'light');
  const [isSavingTextColor, setIsSavingTextColor] = useState(false);
  const [textColorSaved, setTextColorSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customization?.toolbar_text_color) setTextColor(customization.toolbar_text_color);
  }, [customization?.toolbar_text_color]);

  const handleTextColorSave = async () => {
    setIsSavingTextColor(true);
    setTextColorSaved(false);
    setError(null);
    try {
      await setToolbarTextColor(textColor);
      setTextColorSaved(true);
      setTimeout(() => setTextColorSaved(false), 2000);
    } catch {
      setError('Failed to save sidebar text color. Please try again.');
    } finally {
      setIsSavingTextColor(false);
    }
  };

  const previewMeta = buildWallpaperMeta(selected, selectedUrl);
  const previewStyle = previewMeta.style;
  const previewClass = previewMeta.className;
  const hasWallpaper = !!selected;

  const selectPreset = (preset: WallpaperPreset) => {
    setSelected(preset.id);
    setSelectedUrl(null);
    setUploadPreview(null);
    setUploadFile(null);
    setAiResult(null);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB');
      return;
    }
    setError(null);
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setUploadPreview(url);
      setSelected('custom');
      setSelectedUrl(url);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadConfirm = async (): Promise<string | null> => {
    if (!uploadFile) return null;
    setIsUploading(true);
    setError(null);
    try {
      const publicUrl = await uploadWorkspaceWallpaperImage(userId, uploadFile);
      setSelectedUrl(publicUrl);
      setSelected('custom');
      return publicUrl;
    } catch {
      setError('Upload failed. Please try again.');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setAiResult(null);
    try {
      const url = await generateAIWallpaper(`workspace-${userId}`, aiPrompt, 'Workspace');
      setAiResult(url);
      setSelected('custom');
      setSelectedUrl(url);
    } catch {
      setError('Generation failed. Please try a different prompt.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      let resolvedUrl = selectedUrl;
      if (selected === 'custom' && uploadFile && !resolvedUrl?.startsWith('https://')) {
        resolvedUrl = await handleUploadConfirm();
      }
      const finalUrl = resolvedUrl?.startsWith('https://') ? resolvedUrl : null;
      await setWorkspaceWallpaper(selected, finalUrl);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } catch {
      setError('Failed to save wallpaper. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      await setWorkspaceWallpaper(null, null);
      setSelected(null);
      setSelectedUrl(null);
      setUploadPreview(null);
      setUploadFile(null);
      setAiResult(null);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } catch {
      setError('Failed to remove wallpaper.');
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; locked?: boolean }[] = [
    { id: 'live', label: 'Live', icon: <Zap size={15} /> },
    { id: 'gradient', label: 'Gradients', icon: <Palette size={15} /> },
    { id: 'photo', label: 'Photos', icon: <ImageIcon size={15} /> },
    { id: 'upload', label: 'Upload', icon: isPro ? <Upload size={15} /> : <Lock size={15} />, locked: !isPro },
    { id: 'ai', label: 'AI Create', icon: isPro ? <Sparkles size={15} /> : <Lock size={15} />, locked: !isPro },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc]">
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8">
        <button type="button" onClick={() => navigate('/lobby')} className="mb-6 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to Velvet
        </button>

        <div className="mb-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Workspace background</p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Choose a background for your sidebar.</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">This only changes the background behind the workspace sidebar navigation. Your companion chat wallpapers stay separate.</p>
        </div>

        {/* Text color presets — ensure legibility over any wallpaper */}
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Type size={16} className="text-gray-700" />
            <h3 className="text-sm font-bold text-gray-900">Sidebar text color</h3>
          </div>
          <p className="mb-4 text-xs text-gray-500 leading-5">Pick a text color that stays readable over your chosen sidebar background.</p>
          <div className="flex flex-wrap gap-2.5">
            {TOOLBAR_TEXT_COLOR_PRESETS.map(preset => {
              const active = textColor === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => { setTextColor(preset.key); setTextColorSaved(false); }}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 transition-all ${active ? 'border-gray-900 shadow-md' : 'border-gray-200 hover:border-gray-400'}`}
                  aria-pressed={active}
                >
                  <span className="h-5 w-5 rounded-full border border-black/10" style={{ background: preset.color }} />
                  <span className={`text-sm font-semibold ${active ? 'text-gray-900' : 'text-gray-600'}`}>{preset.label}</span>
                  {active && <Check size={14} className="text-gray-900" />}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">
              {textColorSaved ? 'Sidebar text color saved.' : 'Choose a color, then save it.'}
            </p>
            <button
              type="button"
              onClick={handleTextColorSave}
              disabled={isSavingTextColor || textColor === (customization?.toolbar_text_color ?? 'light')}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingTextColor ? 'Saving...' : textColorSaved ? <><Check size={14} /> Saved</> : 'Save text color'}
            </button>
          </div>
        </div>

        {/* Live preview banner */}
        <div className="relative mb-6 h-32 overflow-hidden rounded-2xl sm:h-40">
          <div
            className={`absolute inset-0 transition-all duration-700 ${previewClass}`}
            style={
              hasWallpaper && !previewClass
                ? previewStyle
                : hasWallpaper && previewClass
                ? {}
                : { background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)' }
            }
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {!hasWallpaper && (
              <p className="text-gray-400 text-sm font-medium">Preview will appear here</p>
            )}
          </div>
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <div className="backdrop-blur-md bg-white/20 border border-white/30 rounded-xl px-3 py-1.5">
              <p className="text-white text-xs font-semibold drop-shadow">
                {selected
                  ? selected === 'custom'
                    ? 'Custom Wallpaper'
                    : ALL_PRESETS.find(p => p.id === selected)?.name ?? selected
                  : 'No Wallpaper'}
              </p>
            </div>
          </div>
          {savedNotice && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
              <Check size={14} />
              Saved
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-xl bg-gray-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.locked && setActiveTab(tab.id)}
              title={tab.locked ? 'Pro feature — upgrade to unlock' : undefined}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                tab.locked
                  ? 'text-gray-400 cursor-not-allowed opacity-60'
                  : activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 cursor-pointer'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.locked && <span className="hidden sm:inline text-[10px] font-bold text-amber-500 ml-0.5">Pro</span>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mb-6 min-h-[200px]">
          <AnimatePresence mode="wait">
            {activeTab === 'live' && (
              <motion.div
                key="live"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 px-1 pb-1">
                  <Zap size={13} className="text-amber-500" />
                  <p className="text-xs text-gray-500 font-medium">Animated backgrounds that breathe and shift in real time</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {LIVE_WALLPAPER_PRESETS.map((preset) => (
                    <LivePresetTile
                      key={preset.id}
                      preset={preset}
                      isSelected={selected === preset.id}
                      onSelect={() => selectPreset(preset)}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'gradient' && (
              <motion.div
                key="gradient"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-3 sm:grid-cols-5 gap-2.5"
              >
                {CSS_WALLPAPER_PRESETS.map((preset) => (
                  <PresetTile
                    key={preset.id}
                    preset={preset}
                    isSelected={selected === preset.id}
                    onSelect={() => selectPreset(preset)}
                  />
                ))}
              </motion.div>
            )}

            {activeTab === 'photo' && (
              <motion.div
                key="photo"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
              >
                {PHOTO_WALLPAPER_PRESETS.map((preset) => (
                  <PresetTile
                    key={preset.id}
                    preset={preset}
                    isSelected={selected === preset.id}
                    onSelect={() => selectPreset(preset)}
                  />
                ))}
              </motion.div>
            )}

            {activeTab === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!uploadPreview ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-40 border-2 border-dashed border-gray-200 rounded-2xl hover:border-gray-400 hover:bg-gray-50 transition-all flex flex-col items-center justify-center gap-3 group"
                  >
                    <div className="w-12 h-12 bg-gray-100 group-hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors">
                      <Upload size={22} className="text-gray-400 group-hover:text-gray-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700">Click to upload an image</p>
                      <p className="text-xs text-gray-400 mt-1">JPG, PNG, or WebP — max 10MB</p>
                    </div>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden h-44">
                      <img src={uploadPreview} className="w-full h-full object-cover" alt="Upload preview" />
                      <button
                        onClick={() => {
                          setUploadPreview(null);
                          setUploadFile(null);
                          setSelected(currentWallpaper);
                          setSelectedUrl(currentWallpaperUrl);
                        }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-all"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Choose a different image
                    </button>
                  </div>
                )}

                {isUploading && (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-500">
                    <Loader2 size={16} className="animate-spin" />
                    Uploading image...
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        Let AI design your workspace wallpaper
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Describe a scene or vibe and AI will paint it for you. Takes about 15–30 seconds.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">
                    Describe your wallpaper
                  </label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder={`e.g. "a cozy rainy night coffee shop with warm lighting"`}
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
                    disabled={isGenerating}
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick ideas</p>
                  <div className="flex flex-wrap gap-2">
                    {AI_PROMPT_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setAiPrompt(s)}
                        disabled={isGenerating}
                        className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={!aiPrompt.trim() || isGenerating}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generating your wallpaper...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Generate Wallpaper
                    </>
                  )}
                </button>

                {aiResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl overflow-hidden border-2 border-green-400 shadow-lg"
                  >
                    <img src={aiResult} className="w-full object-cover max-h-44" alt="AI generated wallpaper" />
                    <div className="bg-green-50 px-3 py-2 flex items-center gap-2">
                      <Check size={14} className="text-green-600" />
                      <p className="text-xs text-green-700 font-medium">Wallpaper ready — hit Apply to use it</p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl"
            >
              <AlertCircle size={13} />
              {error}
            </motion.div>
          )}
        </div>

        {/* Action bar — sticky at bottom */}
        <div className="sticky bottom-0 -mx-5 border-t border-gray-100 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            {currentWallpaper ? (
              <button
                onClick={handleRemove}
                disabled={isSaving}
                className="text-sm text-gray-500 hover:text-red-500 font-medium transition-colors disabled:opacity-50"
              >
                Remove wallpaper
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/lobby')}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={isSaving || isGenerating || isUploading || !selected}
                className="px-6 py-2.5 bg-gradient-to-r from-gray-900 to-gray-700 hover:from-gray-800 hover:to-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    Apply Wallpaper
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PresetTileProps {
  preset: WallpaperPreset;
  isSelected: boolean;
  onSelect: () => void;
}

function LivePresetTile({ preset, isSelected, onSelect }: PresetTileProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onSelect}
      className={`relative rounded-xl overflow-hidden aspect-video transition-all ${
        isSelected ? 'ring-3 ring-offset-1 ring-gray-900 shadow-lg' : 'ring-1 ring-gray-200 hover:ring-gray-400'
      }`}
    >
      <div
        className={`w-full h-full ${preset.liveClass ?? ''}`}
        style={!preset.liveClass ? (preset.thumbnailStyle ?? {}) : undefined}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      <div className="absolute top-1.5 left-1.5">
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white/90"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
          <Zap size={8} className="text-amber-400" />
          LIVE
        </span>
      </div>
      <div className="absolute bottom-1.5 left-2 right-2">
        <p className="text-white text-[10px] font-semibold truncate drop-shadow">{preset.name}</p>
      </div>
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
          <Check size={11} className="text-gray-900" />
        </div>
      )}
    </motion.button>
  );
}

function PresetTile({ preset, isSelected, onSelect }: PresetTileProps) {
  const style: React.CSSProperties =
    preset.type === 'css' && preset.cssStyle
      ? { ...preset.cssStyle }
      : {
          backgroundImage: `url(${preset.thumbnail})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        };

  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onSelect}
      className={`relative rounded-xl overflow-hidden aspect-video transition-all ${
        isSelected ? 'ring-3 ring-offset-1 ring-gray-900 shadow-lg' : 'ring-1 ring-gray-200 hover:ring-gray-400'
      }`}
    >
      <div className="w-full h-full" style={style} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      <div className="absolute bottom-1.5 left-2 right-2">
        <p className="text-white text-[10px] font-semibold truncate drop-shadow">{preset.name}</p>
      </div>
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
          <Check size={11} className="text-gray-900" />
        </div>
      )}
    </motion.button>
  );
}
