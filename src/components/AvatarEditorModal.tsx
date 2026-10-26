import { useState, useCallback, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AvatarCreatorV2 } from './AvatarCreatorV2';
import { AvatarConfigV2 } from '../types/avatar-v2';
import { supabase } from '../shared/supabase/client';
import { migrateAvatarConfig } from '../utils/avatarConfig';
import { useAvatarEditor, announceAvatarSaved, type AvatarEditTarget } from '../stores/avatarEditorStore';

// Mounted once (in App). Opens whenever something calls useAvatarEditor().open:
// a face in the sidebar, a chat, or your own avatar in the toolbar.
export function AvatarEditorHost() {
  const target = useAvatarEditor((s) => s.target);
  const close = useAvatarEditor((s) => s.close);
  if (!target) return null;
  return <AvatarEditorModal key={target.kind === 'user' ? 'user' : target.id} target={target} onClose={close} />;
}

interface Loaded { name: string; config: AvatarConfigV2 | null }

async function loadTarget(target: AvatarEditTarget): Promise<Loaded | null> {
  if (target.kind === 'companion') {
    const { data } = await supabase.from('companions').select('custom_name, avatar_config').eq('id', target.id).maybeSingle();
    return data ? { name: data.custom_name || 'Companion', config: data.avatar_config ? migrateAvatarConfig(data.avatar_config) : null } : null;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('user_profiles').select('avatar_config').eq('id', user.id).maybeSingle();
  return { name: 'You', config: data?.avatar_config ? migrateAvatarConfig(data.avatar_config) : null };
}

async function saveTarget(target: AvatarEditTarget, config: AvatarConfigV2): Promise<void> {
  if (target.kind === 'companion') {
    const { error } = await supabase.from('companions').update({ avatar_config: config }).eq('id', target.id);
    if (error) throw error;
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase.from('user_profiles').update({ avatar_config: config }).eq('id', user.id);
  if (error) throw error;
}

function AvatarEditorModal({ target, onClose }: { target: AvatarEditTarget; onClose: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<AvatarConfigV2 | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const namespace = target.kind === 'user' ? 'user' : `companion-${target.id}`;

  useEffect(() => {
    let cancelled = false;
    loadTarget(target)
      .then((l) => { if (!cancelled) { if (l) setLoaded(l); else setFailed(true); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [target]);

  const handleChange = useCallback((config: AvatarConfigV2) => {
    setPendingConfig(config);
  }, []);

  const handleSave = async () => {
    const configToSave = pendingConfig;
    if (!configToSave) return;
    setSaving(true);
    setSaveError(false);
    try {
      await saveTarget(target, configToSave);
      setSaved(true);
      announceAvatarSaved({ target, config: configToSave });
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 800);
    } catch (err) {
      console.error('[AvatarEditorModal] Save failed:', err);
      setSaveError(true);
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
                {target.kind === 'user' ? 'Your avatar' : 'Edit appearance'}
              </h2>
              <p className={`text-sm mt-0.5 ${saveError ? 'text-rose-400' : 'text-gray-500'}`}>
                {saveError ? "Couldn't save. Try again." : target.kind === 'user' ? 'How you look across Velvet' : loaded?.name ?? ''}
              </p>
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
            {loaded ? (
              // No draft key: a quick edit always starts from the saved look.
              <AvatarCreatorV2
                initialConfig={loaded.config ?? undefined}
                onChange={handleChange}
                favoritesNamespace={namespace}
              />
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-gray-500">
                {failed ? "Couldn't load this avatar." : <Loader2 className="h-6 w-6 animate-spin" />}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
