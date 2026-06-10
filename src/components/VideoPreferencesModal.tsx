import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Tag, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { supabase } from '../shared/supabase/client';

interface VideoPreferencesModalProps {
  onClose: () => void;
  onSaved: () => void;
}

interface SourceTag {
  label: string;
  source: string;
}

export function VideoPreferencesModal({ onClose, onSaved }: VideoPreferencesModalProps) {
  const [sourceTags, setSourceTags] = useState<SourceTag[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [disabledTags, setDisabledTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [companionResult, prefsResult] = await Promise.all([
        supabase
          .from('companions')
          .select('hobbies, sports, sports_interests, entertainment_interests, tech_interests, lifestyle_interests, music_genre, interest_text, zodiac_sign, news_categories')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('user_video_preferences')
          .select('custom_tags, disabled_tags')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const c = companionResult.data;
      if (c) {
        const tags: SourceTag[] = [];
        const addArr = (arr: string[] | null, source: string) => {
          (arr || []).forEach(v => v && tags.push({ label: v, source }));
        };
        addArr(c.hobbies, 'Hobbies');
        addArr(c.sports, 'Sports');
        addArr(c.sports_interests, 'Sports Interests');
        addArr(c.entertainment_interests, 'Entertainment');
        addArr(c.tech_interests, 'Tech Interests');
        addArr(c.lifestyle_interests, 'Lifestyle');
        addArr(c.news_categories, 'News Topics');
        if (c.music_genre) tags.push({ label: c.music_genre, source: 'Music' });
        if (c.interest_text) tags.push({ label: c.interest_text, source: 'Your Interests' });
        if (c.zodiac_sign) tags.push({ label: c.zodiac_sign, source: 'Zodiac' });
        setSourceTags(tags);
      }

      if (prefsResult.data) {
        setCustomTags(prefsResult.data.custom_tags || []);
        setDisabledTags(prefsResult.data.disabled_tags || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleDisabled = (tag: string) => {
    setDisabledTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (customTags.includes(trimmed)) {
      setNewTag('');
      return;
    }
    setCustomTags(prev => [...prev, trimmed]);
    setNewTag('');
  };

  const removeCustomTag = (tag: string) => {
    setCustomTags(prev => prev.filter(t => t !== tag));
    setDisabledTags(prev => prev.filter(t => t !== tag));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('user_video_preferences')
        .upsert({
          user_id: user.id,
          custom_tags: customTags,
          disabled_tags: disabledTags,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      setSaved(true);
      setTimeout(() => {
        onSaved();
        onClose();
      }, 700);
    } finally {
      setSaving(false);
    }
  };

  const activeCount = [
    ...sourceTags.filter(t => !disabledTags.includes(t.label)),
    ...customTags.filter(t => !disabledTags.includes(t)),
  ].length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 16 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="bg-[#0f0f18] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Feed Preferences</h2>
            <p className="text-white/40 text-xs mt-0.5">{activeCount} active interest{activeCount !== 1 ? 's' : ''} shaping your feed</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/8 rounded-lg transition-colors text-white/50 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 px-5 py-5 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Tag className="w-3.5 h-3.5 text-white/40" />
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">From Your Questionnaire</span>
              </div>
              <p className="text-xs text-white/30 mb-3">
                These come from what you shared during setup. Toggle any off to stop them from influencing your feed.
              </p>
              {sourceTags.length === 0 ? (
                <p className="text-xs text-white/25 italic">No interests found — complete the questionnaire to populate this.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sourceTags.map(({ label, source }) => {
                    const isOff = disabledTags.includes(label);
                    return (
                      <button
                        key={`${source}-${label}`}
                        onClick={() => toggleDisabled(label)}
                        title={`Source: ${source}`}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          isOff
                            ? 'bg-transparent border-white/10 text-white/25 line-through'
                            : 'bg-white/8 border-white/15 text-white hover:border-red-400/50'
                        }`}
                      >
                        {isOff ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-white/40" />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Plus className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Your Custom Topics</span>
              </div>
              <p className="text-xs text-white/30 mb-3">
                Add anything you want the feed to search for — topics, genres, activities, anything.
              </p>

              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomTag()}
                  placeholder="e.g. jazz, rock climbing, documentary..."
                  className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-red-400/50 text-sm transition-colors"
                  maxLength={40}
                />
                <button
                  onClick={addCustomTag}
                  disabled={!newTag.trim()}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-white/8 disabled:text-white/20 text-white text-sm font-semibold rounded-xl transition-all disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>

              {customTags.length === 0 ? (
                <p className="text-xs text-white/25 italic">No custom topics yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {customTags.map(tag => {
                    const isOff = disabledTags.includes(tag);
                    return (
                      <div
                        key={tag}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isOff
                            ? 'bg-transparent border-white/10 text-white/25'
                            : 'bg-red-500/15 border-red-400/30 text-red-300'
                        }`}
                      >
                        <button onClick={() => toggleDisabled(tag)} className="mr-0.5">
                          {isOff ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        {tag}
                        <button
                          onClick={() => removeCustomTag(tag)}
                          className="ml-1 text-white/30 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-5 py-4 border-t border-white/8 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="w-full py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-white/8 disabled:text-white/20 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
