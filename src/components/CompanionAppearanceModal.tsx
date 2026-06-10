import { useState, useCallback } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarCreatorV2 } from './AvatarCreatorV2';
import { AvatarConfigV2 } from '../types/avatar-v2';
import { supabase } from '../shared/supabase/client';

interface CompanionAppearanceModalProps {
  companionId: string;
  companionName: string;
  currentConfig: AvatarConfigV2 | null;
  onClose: () => void;
  onSaved: (config: AvatarConfigV2) => void;
}

export function CompanionAppearanceModal({
  companionId,
  companionName,
  currentConfig,
  onClose,
  onSaved,
}: CompanionAppearanceModalProps) {
  const [pendingConfig, setPendingConfig] = useState<AvatarConfigV2 | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = useCallback((config: AvatarConfigV2) => {
    setPendingConfig(config);
  }, []);

  const handleSave = async () => {
    const configToSave = pendingConfig;
    if (!configToSave) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('companions')
        .update({ avatar_config: configToSave })
        .eq('id', companionId);

      if (error) throw error;

      setSaved(true);
      onSaved(configToSave);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 800);
    } catch (err) {
      console.error('[CompanionAppearanceModal] Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-stretch justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          className="relative z-10 w-full max-w-5xl flex flex-col bg-[#080d14] shadow-2xl
            overflow-hidden my-4 mx-4 rounded-2xl border border-white/10"
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">
                Edit Appearance
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">{companionName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={!pendingConfig || saving || saved}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                  transition-all border disabled:opacity-40 disabled:cursor-not-allowed
                  ${saved
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-sky-600 border-sky-500 text-white hover:bg-sky-500'
                  }`}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-xl
                  bg-white/5 border border-white/10 text-gray-400
                  hover:bg-white/10 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <AvatarCreatorV2
              initialConfig={currentConfig ?? undefined}
              onChange={handleChange}
              draftKey={`companion-appearance-draft-${companionId}`}
              favoritesNamespace={`companion-${companionId}`}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
