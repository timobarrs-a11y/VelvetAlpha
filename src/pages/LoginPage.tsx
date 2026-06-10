import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Heart, ChevronRight } from 'lucide-react';
import { authService } from '../services/authService';
import { Button, Input } from '../shared/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/Avatar';
import { AvatarConfig, DEFAULT_MALE_AVATAR, DEFAULT_FEMALE_AVATAR } from '../types/avatar';

const VELVET_BG = 'linear-gradient(175deg, #1e2a7a 0%, #141a55 40%, #0d0f3c 100%)';
const VELVET_RADIAL = `radial-gradient(ellipse 90% 50% at 50% -5%, rgba(80,100,255,0.30) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 20% 110%, rgba(244,63,107,0.12) 0%, transparent 50%)`;

interface CompanionChoice {
  id: string;
  name: string;
  gender?: string;
  avatar_config?: AvatarConfig | null;
}

function CompanionPickerModal({
  companions,
  onSelect,
}: {
  companions: CompanionChoice[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative w-full max-w-sm rounded-3xl p-6"
        style={{
          background: 'rgba(13,15,55,0.96)',
          border: '1px solid rgba(100,120,255,0.30)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.60)',
        }}
      >
        <div className="flex items-center justify-center mb-2">
          <Heart className="w-6 h-6 text-pink-400" fill="currentColor" />
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-1">Who would you like to chat with?</h2>
        <p className="text-blue-200/60 text-sm text-center mb-6">Choose a companion to open their chat.</p>

        <div className="space-y-2">
          {companions.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,107,0.14)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,63,107,0.35)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)';
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/10">
                  <Avatar
                    config={c.avatar_config ?? (c.gender === 'male' ? DEFAULT_MALE_AVATAR : DEFAULT_FEMALE_AVATAR)}
                    className="w-full h-full"
                  />
                </div>
                <span className="text-white font-semibold">{c.name}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-200/50 group-hover:text-pink-400 transition-colors" />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [companions, setCompanions] = useState<CompanionChoice[]>([]);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { companions: found } = await authService.signIn(email, password);

      if (found.length === 0) {
        navigate('/create-user-avatar');
      } else if (found.length === 1) {
        navigate(`/chat?companion=${found[0].id}`);
      } else {
        setCompanions(found);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to log in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanionSelect = (id: string) => {
    navigate(`/chat?companion=${id}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: VELVET_BG }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: VELVET_RADIAL }} />

      <AnimatePresence>
        {companions.length > 1 && (
          <CompanionPickerModal companions={companions} onSelect={handleCompanionSelect} />
        )}
      </AnimatePresence>

      <div className="relative max-w-md w-full">
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
            background: 'rgba(13,15,55,0.82)',
            border: '1px solid rgba(100,120,255,0.28)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.50)',
          }}
        >
          <div className="text-center mb-7">
            <h2 className="text-2xl font-bold text-white font-display mb-1">Welcome Back</h2>
            <p className="text-blue-200/70 text-sm">Sign in to continue your journey</p>
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
                <label className="block text-sm font-medium text-blue-200/80">Password</label>
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
            <p className="text-blue-200/70 text-sm">
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
    </div>
  );
}
