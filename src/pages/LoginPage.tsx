import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Heart } from 'lucide-react';
import { authService } from '../services/authService';
import { useAuth } from '../auth/AuthProvider';
import { Button, Input } from '../shared/ui';

const VELVET_BG = 'var(--ds-bg-page)';
const VELVET_RADIAL = `radial-gradient(ellipse 90% 50% at 50% -5%, rgba(80,100,255,0.30) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 20% 110%, rgba(244,63,107,0.12) 0%, transparent 50%)`;

export default function LoginPage() {
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: VELVET_BG }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: VELVET_RADIAL }} />

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
            background: 'var(--ds-surface-3)',
            border: '1px solid var(--ds-border-strong)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.50)',
          }}
        >
          <div className="text-center mb-7">
            <h2 className="text-2xl font-bold text-white font-display mb-1">Welcome Back</h2>
            <p className="text-ink-secondary text-sm">Sign in to continue your journey</p>
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
    </div>
  );
}
