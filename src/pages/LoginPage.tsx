import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Heart, Target, Newspaper, Users, Flame, Trophy, Check, Circle, ChevronDown, type LucideIcon } from 'lucide-react';
import { authService } from '../services/authService';
import { useAuth } from '../auth/AuthProvider';
import { Button, Input } from '../shared/ui';

const VELVET_BG = 'var(--ds-bg-page)';
const VELVET_RADIAL = `radial-gradient(ellipse 90% 50% at 50% -5%, rgba(80,100,255,0.30) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 20% 110%, rgba(244,63,107,0.12) 0%, transparent 50%)`;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'We missed you';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// What is waiting inside. Illustrative only: nothing here is read from an account.
type Waiting = { id: string; icon: LucideIcon; color: string; title: string; text: string };

const WAITING: Waiting[] = [
  { id: 'coach', icon: Target, color: '52,211,153', title: 'Your coach', text: 'Check-ins and the next step of your plan.' },
  { id: 'feed', icon: Newspaper, color: '251,191,36', title: 'Your feed', text: 'Fresh stories and videos on your topics.' },
  { id: 'spaces', icon: Users, color: '56,189,248', title: 'Your spaces', text: 'Rooms, friends, and replies to catch up on.' },
  { id: 'board', icon: Trophy, color: '244,114,182', title: 'Leaderboards', text: 'See where you stand with your friends.' },
];

const STEPS = ['Tue · 4 mi easy', 'Thu · intervals', 'Sat · 5K tempo'];
const TOPICS: Record<string, string[]> = {
  'AI & ML': ['The small models quietly running your phone', 'What open-weight models changed this year'],
  Basketball: ['Why the corner three became the most valuable shot', 'The rookie who never misses at the line'],
  'Lo-fi': ['Bedroom producers on the albums that shaped them', 'Ten beats to write to'],
};
const BOARD = {
  Week: [['Dre', '48,210'], ['You', '44,980'], ['Sam', '41,305']],
  Month: [['You', '212,400'], ['Dre', '208,115'], ['Jules', '190,760']],
} as const;

function Chipbtn({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
      style={{
        background: active ? `rgba(${color},0.18)` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? `rgba(${color},0.4)` : 'rgba(255,255,255,0.1)'}`,
        color: active ? '#fff' : 'rgba(202,197,240,0.7)',
      }}
    >
      {children}
    </button>
  );
}

function CardBody({ id, color }: { id: string; color: string }) {
  const [done, setDone] = useState<boolean[]>([true, true, false]);
  const [topic, setTopic] = useState('AI & ML');
  const [waved, setWaved] = useState(false);
  const [range, setRange] = useState<keyof typeof BOARD>('Week');

  if (id === 'coach') {
    const count = done.filter(Boolean).length;
    return (
      <div className="space-y-2">
        {STEPS.map((step, i) => (
          <button
            key={step}
            type="button"
            role="checkbox"
            aria-checked={done[i]}
            onClick={() => setDone(d => d.map((v, j) => (j === i ? !v : v)))}
            className="w-full flex items-center gap-2.5 text-left text-[13px]"
          >
            {done[i] ? <Check className="w-4 h-4" style={{ color: `rgb(${color})` }} /> : <Circle className="w-4 h-4 text-amber-300" />}
            <span className={done[i] ? 'text-gray-400 line-through decoration-white/20' : 'text-white'}>{step}</span>
          </button>
        ))}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(count / STEPS.length) * 100}%`, background: `rgb(${color})` }} />
        </div>
        <p className="text-xs text-ink-secondary">{count === STEPS.length ? 'Week complete. Nice work.' : `${count} of ${STEPS.length} done this week`}</p>
      </div>
    );
  }
  if (id === 'feed') {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(TOPICS).map(t => <Chipbtn key={t} active={topic === t} color={color} onClick={() => setTopic(t)}>{t}</Chipbtn>)}
        </div>
        <ul className="space-y-1.5">
          {TOPICS[topic].map(title => <li key={title} className="text-[13px] text-gray-200 leading-snug">{title}</li>)}
        </ul>
      </div>
    );
  }
  if (id === 'spaces') {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-white font-medium">Jules is in Gaming Lounge</p>
          <p className="text-xs text-ink-secondary">&ldquo;anyone down for a co-op run tonight?&rdquo;</p>
        </div>
        <button
          type="button"
          onClick={() => setWaved(w => !w)}
          aria-pressed={waved}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold text-white transition-colors"
          style={{ background: `rgba(${color},${waved ? 0.1 : 0.22})`, border: `1px solid rgba(${color},0.4)` }}
        >
          {waved ? 'Waved 👋' : 'Wave hello'}
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      <div className="flex gap-1.5">
        {(Object.keys(BOARD) as (keyof typeof BOARD)[]).map(r => <Chipbtn key={r} active={range === r} color={color} onClick={() => setRange(r)}>{r}</Chipbtn>)}
      </div>
      {BOARD[range].map(([name, score], i) => (
        <div key={name} className="flex items-center gap-3 text-[13px]">
          <span className="w-4 text-center font-bold text-gray-400">{i + 1}</span>
          <span className={name === 'You' ? 'text-white font-semibold' : 'text-gray-300'}>{name}</span>
          <span className="ml-auto text-gray-300">{score}</span>
        </div>
      ))}
    </div>
  );
}

function WhileYouWereAway({ reduce }: { reduce: boolean }) {
  const [open, setOpen] = useState<string | null>('coach');
  return (
    <div className="w-full max-w-md">
      <p className="text-[11px] font-bold tracking-[0.22em] uppercase mb-5 text-purple-300">While you were away</p>
      <div className="space-y-3">
        {WAITING.map((w, i) => {
          const isOpen = open === w.id;
          return (
            <motion.div
              key={w.id}
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl overflow-hidden"
              style={{
                background: isOpen ? `rgba(${w.color},0.06)` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isOpen ? `rgba(${w.color},0.3)` : 'rgba(255,255,255,0.07)'}`,
                transition: 'background 0.3s, border-color 0.3s',
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : w.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-4 p-4 text-left"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `rgba(${w.color},0.14)`, border: `1px solid rgba(${w.color},0.28)` }}
                >
                  <w.icon className="w-[18px] h-[18px]" style={{ color: `rgb(${w.color})` }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-semibold">{w.title}</p>
                  <p className="text-[13px] text-ink-secondary">{w.text}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="px-4 pb-4 pt-1"><CardBody id={w.id} color={w.color} /></div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-5 flex items-center gap-2 text-[13px] text-ink-secondary">
        <Flame className="w-4 h-4 text-orange-300" /> Keep your streak going. It only takes a minute.
      </p>
    </div>
  );
}

export default function LoginPage() {
  const reduce = useReducedMotion() ?? false;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await authService.signIn(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to log in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Already signed in (e.g. back button, or the sign-in just finished): go to the app.
  if (user && !isLoading) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 lg:gap-20 lg:px-16" style={{ background: VELVET_BG }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: VELVET_RADIAL }} />

      <div className="relative max-w-md w-full lg:flex-shrink-0">
        {/* Glossy logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-2">
            <Heart className="w-8 h-8 text-pink-400" fill="currentColor" style={{ filter: 'drop-shadow(0 0 10px rgba(244,114,182,0.75))' }} />
          </div>
          <h1
            className="text-3xl font-bold font-display"
            style={{
              background: 'linear-gradient(135deg, #f472b6 0%, #c084fc 45%, #818cf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 10px rgba(192,132,252,0.50))',
            }}
          >
            Project Velvet
          </h1>
        </div>

        <div
          className="rounded-3xl p-8"
          style={{
            background: 'var(--ds-surface-3)',
            border: '1px solid var(--ds-border-strong)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.50)',
          }}
        >
          <div className="text-center mb-7">
            <h2 className="text-2xl font-bold text-white font-display mb-1">Welcome back</h2>
            <p className="text-ink-secondary text-sm">{greeting()}. Sign in to pick up where you left off.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.40)' }}>
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm font-medium">{error}</p>
              </div>
            )}

            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={isLoading}
              label="Email"
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-ink-secondary">Password</label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-pink-400 hover:text-pink-300 text-sm font-medium transition"
                >
                  Forgot?
                </button>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isLoading}
              />
            </div>

            <Button type="submit" disabled={isLoading} isLoading={isLoading} fullWidth size="lg">
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-ink-secondary text-sm">
              Don&apos;t have an account?{' '}
              <button
                onClick={() => navigate('/signup')}
                className="text-pink-400 hover:text-pink-300 font-semibold transition"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>

        <nav aria-label="Site links" className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-gray-500">
          {[
            { label: 'About', to: '/about' },
            { label: 'Updates', to: '/updates' },
            { label: 'Support us', to: '/support' },
            { label: 'Terms', to: '/terms' },
            { label: 'Privacy', to: '/privacy' },
          ].map(l => (
            <button key={l.to} type="button" onClick={() => navigate(l.to)} className="hover:text-white transition-colors">{l.label}</button>
          ))}
        </nav>
        <p className="mt-3 text-center text-gray-600 text-xs">© {new Date().getFullYear()} Project Velvet</p>
      </div>

      <div className="relative hidden lg:block">
        <WhileYouWereAway reduce={reduce} />
      </div>
    </div>
  );
}
