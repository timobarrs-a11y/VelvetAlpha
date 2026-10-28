import { motion } from 'framer-motion';
import { Check, Mic, Shuffle } from 'lucide-react';
import { AvatarV2 } from './AvatarV2';
import type { AvatarConfigV2 } from '../types/avatar-v2';
import type { SignatureVoice } from '../config/signatureVoices';

interface MatchFoundCardProps {
  name: string;
  avatar: AvatarConfigV2;
  voice: SignatureVoice | undefined;
  isFriend: boolean;
  /** True while the approved match is being saved: both buttons wait. */
  saving: boolean;
  onApprove: () => void;
  onAnother: () => void;
}

/** The end of "Let us matchmake for you": who they got, and the choice to keep them or ask for someone else. */
export function MatchFoundCard({ name, avatar, voice, isFriend, saving, onApprove, onAnother }: MatchFoundCardProps) {
  const noun = isFriend ? 'friend' : 'companion';
  return (
    <motion.div
      className="w-full max-w-sm mx-auto text-center"
      initial={{ opacity: 0, scale: 0.92, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
    >
      <p className="text-xs font-semibold tracking-widest uppercase text-emerald-400 mb-2">Match found</p>
      <h2 className="text-3xl font-black text-white mb-6">Meet {name}.</h2>

      <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#111827] to-[#0a0f1a] p-6 shadow-2xl shadow-amber-500/10">
        <div className="mx-auto w-44 h-44 rounded-2xl overflow-hidden bg-[radial-gradient(ellipse_at_center,_#1e2a3a_0%,_#060a0f_100%)] ring-2 ring-amber-500/30">
          <AvatarV2 config={avatar} className="w-full h-full" />
        </div>

        <div className="text-2xl font-bold text-white mt-5">{name}</div>

        {voice && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-amber-400">
              <Mic className="w-3 h-3" />
              Signature voice
            </div>
            <div className="text-white font-semibold mt-1">{voice.name}</div>
            <div className="text-gray-400 text-sm">{voice.description}</div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <motion.button
          onClick={onApprove}
          disabled={saving}
          whileHover={saving ? undefined : { scale: 1.02 }}
          whileTap={saving ? undefined : { scale: 0.98 }}
          className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base shadow-2xl shadow-amber-500/30 disabled:opacity-60"
        >
          <Check className="w-5 h-5" />
          {saving ? 'Introducing you…' : `Yes, this is my ${noun}`}
        </motion.button>
        <button
          onClick={onAnother}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-white/15 text-gray-300 hover:text-white hover:border-white/30 transition-colors disabled:opacity-40"
        >
          <Shuffle className="w-4 h-4" />
          Show me someone else
        </button>
      </div>
    </motion.div>
  );
}
