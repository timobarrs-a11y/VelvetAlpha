import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Sparkles, Check, ImageIcon, Palette, Loader2, AlertCircle, Lock, Zap } from 'lucide-react';
import {
  CSS_WALLPAPER_PRESETS,
  PHOTO_WALLPAPER_PRESETS,
  LIVE_WALLPAPER_PRESETS,
  buildWallpaperStyle,
  buildWallpaperMeta,
  saveCompanionWallpaper,
  uploadWallpaperImage,
  generateAIWallpaper,
  WallpaperPreset,
} from '../services/wallpaperService';
import { SubscriptionTier } from '../types/subscription';

type Tab = 'live' | 'gradient' | 'photo' | 'upload' | 'ai';

const PRO_TIERS: SubscriptionTier[] = ['plus', 'elite', 'trial'];

function isProTier(tier: SubscriptionTier): boolean {
  return PRO_TIERS.includes(tier);
}

interface WallpaperPickerModalProps {
  companionId: string;
  companionName: string;
  userId: string;
  userTier?: SubscriptionTier;
  currentWallpaper: string | null;
  currentWallpaperUrl: string | null;
  onClose: () => void;
  onSaved: (wallpaperId: string | null, wallpaperUrl: string | null) => void;
}

export function WallpaperPickerModal({
  companionId,
  companionName,
  userId,
  userTier = 'free',
  currentWallpaper,
  currentWallpaperUrl,
  onClose,
  onSaved,
}: WallpaperPickerModalProps) {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUploadConfirm = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    setError(null);
    try {
      const publicUrl = await uploadWallpaperImage(userId, companionId, uploadFile);
      setSelectedUrl(publicUrl);
      setSelected('custom');
    } catch (err) {
      setError('Upload failed. Please try again.');
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
      const url = await generateAIWallpaper(companionId, aiPrompt, companionName);
      setAiResult(url);
      setSelected('custom');
      setSelectedUrl(url);
    } catch (err) {
      setError('Generation failed. Please try a different prompt.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      if (selected === 'custom' && uploadFile && !selectedUrl?.startsWith('https://')) {
        await handleUploadConfirm();
      }
      await saveCompanionWallpaper(companionId, selected, selectedUrl?.startsWith('https://') ? selectedUrl : null);
      onSaved(selected, selectedUrl?.startsWith('https://') ? selectedUrl : null);
      onClose();
    } catch (err) {
      setError('Failed to save wallpaper. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      await saveCompanionWallpaper(companionId, null, null);
      onSaved(null, null);
      onClose();
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

  const AI_PROMPT_SUGGESTIONS = [
    `a cozy rainy night coffee shop`,
    `a cherry blossom park in spring`,
    `a neon-lit cyberpunk city street`,
    `a peaceful mountain lake at dawn`,
    `a luxurious art deco hotel lobby`,
    `a dreamy galaxy with colorful nebulae`,
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="relative h-36 sm:h-44 flex-shrink-0 overflow-hidden">
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
                    : [...CSS_WALLPAPER_PRESETS, ...PHOTO_WALLPAPER_PRESETS, ...LIVE_WALLPAPER_PRESETS].find(p => p.id === selected)?.name ?? selected
                  : 'No Wallpaper'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 sm:px-6 pt-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Chat Wallpaper</h2>
              <p className="text-xs text-gray-500 mt-0.5">Choose a background for your chat with {companionName}</p>
            </div>
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
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
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 min-h-0">
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
                        Let {companionName} design your wallpaper
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
              className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl"
            >
              <AlertCircle size={13} />
              {error}
            </motion.div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
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
              onClick={onClose}
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
      </motion.div>
    </div>
  );
}

interface PresetTileProps {
  preset: WallpaperPreset;
  isSelected: boolean;
  onSelect: () => void;
}

interface LivePresetTileProps {
  preset: WallpaperPreset;
  isSelected: boolean;
  onSelect: () => void;
}

function LivePresetTile({ preset, isSelected, onSelect }: LivePresetTileProps) {
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
