import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Heart, Target, Newspaper, Users, Flame, Trophy, type LucideIcon } from 'lucide-react';
import { authService } from '../services/authService';
import { useAuth } from '../auth/AuthProvider';
import { Button, Input } from '../shared/ui';

const VELVET_BG = 'var(--ds-bg-page)';
const VELVET_RADIAL = `radial-gradient(ellipse 90% 50% at 50% -5%, rgba(80,100,255,0.30) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 20% 110%, rgba(244,63,107,0.12) 0%, transparent 50%)`;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5 || h >= 18) return 'Good evening';
  if (h < 12) return 'Good morning';
  return 'Good afternoon';
}

// What is waiting inside. Illustrative only: nothing here is read from an account.
const WAITING: { icon: LucideIcon; color: string; title: string; text: string }[] = [
  { icon: Target, color: '52,211,153', title: 'Your coach', text: 'Check-ins and the next step of your plan.' },
  { icon: Newspaper, color: '251,191,36', title: 'Your feed', text: 'Fresh stories and videos on your topics.' },
  { icon: Users, color: '56,189,248', title: 'Your spaces', text: 'Rooms, friends, and replies to catch up on.' },
  { icon: Trophy, color: '244,114,182', title: 'Leaderboards', text: 'See where you stand with your friends.' },
];

function WhileYouWereAway({ reduce }: { reduce: boolean }) {
  return (
    <div className="w-full max-w-md">
      <p className="text-[11px] font-bold tracking-[0.22em] uppercase mb-5 text-purple-300">While you were away</p>
      <div className="space-y-3">
        {WAITING.map((w, i) => (
          <motion.div
            key={w.title}
            initial={reduce ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-4 rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `rgba(${w.color},0.14)`, border: `1px solid rgba(${w.color},0.28)` }}
            >
              <w.icon className="w-[18px] h-[18px]" style={{ color: `rgb(${w.color})` }} />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold">{w.title}</p>
              <p className="text-[13px] text-ink-secondary">{w.text}</p>
            </div>
          </motion.div>
        ))}
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
      </div>

      <div className="relative hidden lg:block">
        <WhileYouWereAway reduce={reduce} />
      </div>
    </div>
  );
}
