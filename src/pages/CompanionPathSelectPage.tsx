import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, PenLine, ChevronRight, Shuffle, Lock, Star, Zap, Heart, Brain, MessageCircle } from 'lucide-react';

type Phase = 'choose' | 'gender' | 'scanning' | 'reveal';
type Gender = 'Female' | 'Male';

const SCAN_NAMES_FEMALE = [
  'Aria', 'Luna', 'Nova', 'Sage', 'Iris', 'Cleo', 'Mia', 'Zoe', 'Nora', 'Jade',
  'Lily', 'Ruby', 'Skye', 'Vera', 'Wren', 'Faye', 'Nyx', 'Remy', 'Sloane', 'Tessa',
];
const SCAN_NAMES_MALE = [
  'Kai', 'Leo', 'Rex', 'Ace', 'Ryu', 'Jax', 'Eli', 'Max', 'Cole', 'Finn',
  'Grey', 'Nash', 'Reed', 'Seth', 'Tate', 'Vance', 'Zane', 'Beau', 'Cruz', 'Dax',
];

const TRAIT_POOL = [
  'Witty', 'Passionate', 'Mysterious', 'Playful', 'Empathetic', 'Bold',
  'Thoughtful', 'Adventurous', 'Warm', 'Direct', 'Curious', 'Fierce',
  'Gentle', 'Sarcastic', 'Devoted', 'Spontaneous', 'Calm', 'Intense',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ScanningScreen({ onReveal, gender }: { onReveal: () => void; gender: Gender }) {
  const [scanIndex, setScanIndex] = useState(0);
  const [traits, setTraits] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentName, setCurrentName] = useState('');
  const [lockedTraits, setLockedTraits] = useState<string[]>([]);
  const [phase, setPhase] = useState<'scanning' | 'locking' | 'done'>('scanning');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const namePool = gender === 'Male' ? SCAN_NAMES_MALE : SCAN_NAMES_FEMALE;

  useEffect(() => {
    const allNames = namePool;

    intervalRef.current = setInterval(() => {
      setScanIndex(i => i + 1);
      setCurrentName(pickRandom(allNames));
      setTraits(() => Array.from({ length: 4 }, () => pickRandom(TRAIT_POOL)));
      setProgress(p => {
        const next = Math.min(p + Math.random() * 6 + 2, 100);
        return next;
      });
    }, 90);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPhase('locking');
      const finalTraits = Array.from({ length: 4 }, () => pickRandom(TRAIT_POOL));
      let count = 0;
      const lockInterval = setInterval(() => {
        setLockedTraits(prev => [...prev, finalTraits[count]]);
        count++;
        if (count >= 4) {
          clearInterval(lockInterval);
          setPhase('done');
          setTimeout(onReveal, 900);
        }
      }, 350);
    }
  }, [progress, onReveal]);

  return (
    <motion.div
      className="w-full max-w-lg mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold tracking-widest uppercase mb-5">
          <Zap className="w-3 h-3" />
          Searching the Velvet Roster
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Finding Your Match...</h2>
        <p className="text-gray-400 text-sm">Scanning thousands of personality combinations.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur p-6 mb-6 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute inset-0 border-t-2 border-amber-400/30"
            animate={{ y: ['0%', '100%', '0%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-gray-600 font-mono uppercase tracking-widest">Profile</div>
          <div className="text-xs text-gray-600 font-mono">
            {phase === 'done' ? (
              <span className="text-emerald-400">MATCH FOUND</span>
            ) : (
              <span className="text-amber-400 animate-pulse">SCANNING...</span>
            )}
          </div>
        </div>

        <motion.div
          key={scanIndex}
          className="text-2xl font-black text-white mb-4 font-mono"
          animate={phase === 'scanning' ? { opacity: [0, 1] } : { opacity: 1 }}
          transition={{ duration: 0.05 }}
        >
          {phase === 'done'
            ? <span className="text-amber-400">???</span>
            : currentName || '...'}
        </motion.div>

        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => {
            const isLocked = lockedTraits[i] !== undefined;
            const trait = isLocked ? lockedTraits[i] : (traits[i] || '...');
            return (
              <motion.div
                key={i}
                animate={isLocked ? { scale: [1.05, 1] } : {}}
                transition={{ duration: 0.2 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isLocked
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                    : 'bg-white/5 border border-white/10 text-gray-400'
                }`}
              >
                {isLocked ? <Lock className="w-3 h-3 flex-shrink-0" /> : <div className="w-3 h-3 rounded-full bg-white/10 flex-shrink-0" />}
                <span className={isLocked ? '' : 'blur-[2px] select-none'}>{trait}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-gray-600 font-mono">
        <span>Analyzing compatibility...</span>
        <span>{Math.round(progress)}%</span>
      </div>
    </motion.div>
  );
}

function RevealScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <motion.div
      className="w-full max-w-lg mx-auto text-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <motion.div
        className="relative inline-flex items-center justify-center w-28 h-28 mb-6"
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
        <div className="absolute inset-0 rounded-full bg-amber-500/10 border-2 border-amber-500/40" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/50 flex items-center justify-center">
          <Star className="w-10 h-10 text-amber-400" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-3xl font-black text-white mb-3">Match Found.</h2>
        <p className="text-gray-400 mb-2 leading-relaxed max-w-sm mx-auto">
          Your companion has been generated from inside the Velvet Rope — a one-of-a-kind personality crafted just for you.
        </p>
        <p className="text-gray-600 text-sm mb-8">
          Now it's time to give them a face.
        </p>

        <motion.button
          onClick={onContinue}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base shadow-2xl shadow-amber-500/30 hover:shadow-amber-500/50 transition-all"
        >
          <Sparkles className="w-5 h-5" />
          Design Their Look
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

export function CompanionPathSelectPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('choose');
  const [selectedGender, setSelectedGender] = useState<Gender>('Female');

  const handleBuildOwn = () => {
    navigate('/questionnaire?mode=companion');
  };

  const handleVelvet = () => {
    setPhase('gender');
  };

  const handleGenderSelect = (g: Gender) => {
    setSelectedGender(g);
    setPhase('scanning');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {phase === 'choose' && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <div className="text-center mb-10">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/20 mb-5"
                >
                  <Sparkles className="w-7 h-7 text-rose-400" />
                </motion.div>
                <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
                  Create Your Companion
                </h1>
                <p className="text-gray-400 text-base leading-relaxed max-w-sm mx-auto">
                  How do you want to shape who they are?
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  onClick={handleBuildOwn}
                  className="w-full group relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-pink-500/5 hover:from-rose-500/20 hover:to-pink-500/15 p-6 text-left transition-all duration-300 hover:border-rose-400/50 hover:shadow-xl hover:shadow-rose-500/10"
                >
                  <div className="flex items-start gap-5">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center group-hover:bg-rose-500/30 transition-colors mt-0.5">
                      <PenLine className="w-6 h-6 text-rose-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold text-white">Build Your Own</h2>
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-rose-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </div>
                      <p className="text-gray-400 text-sm leading-relaxed mb-4">
                        You're the architect. Choose every dimension of your companion's personality — how they flirt, their humor, how they handle conflict, their passions, and more.
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { icon: Heart, label: 'Love Language' },
                          { icon: Brain, label: 'Personality' },
                          { icon: MessageCircle, label: 'Humor Style' },
                        ].map(({ icon: Icon, label }) => (
                          <div key={label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                            <Icon className="w-3 h-3 text-rose-400 flex-shrink-0" />
                            <span className="text-xs text-rose-300 truncate">{label}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-gray-600 text-xs mt-3">About 5 minutes &bull; You name them &bull; You design the look</p>
                    </div>
                  </div>
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  onClick={handleVelvet}
                  className="w-full group relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 hover:from-amber-500/20 hover:to-orange-500/15 p-6 text-left transition-all duration-300 hover:border-amber-400/50 hover:shadow-xl hover:shadow-amber-500/10"
                >
                  <div className="absolute top-4 right-4">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold">
                      Random
                    </span>
                  </div>
                  <div className="flex items-start gap-5">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors mt-0.5">
                      <Shuffle className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0 pr-16">
                      <h2 className="text-xl font-bold text-white mb-2">From Inside the Velvet Rope</h2>
                      <p className="text-gray-400 text-sm leading-relaxed mb-4">
                        Let the universe decide. We'll pull a fully-formed personality from deep inside the Velvet Roster — you won't know who you're getting until the reveal.
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { icon: Zap, label: 'Instant Match' },
                          { icon: Star, label: 'Unique Name' },
                          { icon: Sparkles, label: 'Surprise' },
                        ].map(({ icon: Icon, label }) => (
                          <div key={label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <Icon className="w-3 h-3 text-amber-400 flex-shrink-0" />
                            <span className="text-xs text-amber-300 truncate">{label}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-gray-600 text-xs mt-3">Instant &bull; You still design the look &bull; Always one-of-a-kind</p>
                    </div>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}

          {phase === 'gender' && (
            <motion.div
              key="gender"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="w-full max-w-lg mx-auto"
            >
              <div className="text-center mb-10">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold tracking-widest uppercase mb-5"
                >
                  <Zap className="w-3 h-3" />
                  Velvet Rope
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">
                  Who Are You Looking For?
                </h2>
                <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">
                  We'll match the Velvet Roster to exactly who you have in mind.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {([
                  { value: 'Female' as Gender, label: 'Female', symbol: '♀' },
                  { value: 'Male' as Gender, label: 'Male', symbol: '♂' },
                ] as const).map(({ value, label, symbol }) => (
                  <motion.button
                    key={value}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: value === 'Female' ? 0.2 : 0.3 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleGenderSelect(value)}
                    className="group relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 hover:from-amber-500/20 hover:to-orange-500/15 p-8 flex flex-col items-center gap-4 transition-all duration-300 hover:border-amber-400/60 hover:shadow-xl hover:shadow-amber-500/15"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors flex items-center justify-center">
                      <span className="text-3xl text-amber-400 font-light leading-none">{symbol}</span>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-white mb-1">{label}</div>
                      <div className="text-xs text-amber-400/70 font-medium tracking-wide uppercase">
                        {value === 'Female' ? 'She / Her' : 'He / Him'}
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/0 to-transparent group-hover:via-amber-500/60 transition-all duration-300" />
                  </motion.button>
                ))}
              </div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={() => setPhase('choose')}
                className="mt-6 w-full text-center text-sm text-gray-600 hover:text-gray-400 transition-colors py-2"
              >
                Back
              </motion.button>
            </motion.div>
          )}

          {phase === 'scanning' && (
            <ScanningScreen onReveal={() => setPhase('reveal')} gender={selectedGender} />
          )}

          {phase === 'reveal' && (
            <RevealScreen onContinue={() => navigate(`/questionnaire?mode=velvet&gender=${selectedGender}`)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
