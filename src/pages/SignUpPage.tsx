import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Heart } from 'lucide-react';
import { authService } from '../services/authService';
import { Button, Input } from '../shared/ui';

const VELVET_BG = 'linear-gradient(175deg, #1e2a7a 0%, #141a55 40%, #0d0f3c 100%)';
const VELVET_RADIAL = `radial-gradient(ellipse 90% 50% at 50% -5%, rgba(80,100,255,0.30) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 20% 110%, rgba(244,63,107,0.12) 0%, transparent 50%)`;

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const validatePassword = (pwd: string) => pwd.length >= 6;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validatePassword(password)) { setError('Password must be at least 6 characters long'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setIsLoading(true);
    try {
      await authService.signUp(email, password);
      navigate('/welcome');
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordValid = password.length >= 6;
  const passwordsMatch = password === confirmPassword && confirmPassword !== '';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: VELVET_BG }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: VELVET_RADIAL }} />

      <div className="relative max-w-md w-full">
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
            <h2 className="text-2xl font-bold text-white font-display mb-1">Create Account</h2>
            <p className="text-blue-200/70 text-sm">Start your journey with your AI companion</p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-5">
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
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                disabled={isLoading}
                label="Password"
                error={password && !passwordValid ? 'Password must be at least 6 characters' : undefined}
              />
              {password && passwordValid && (
                <div className="flex items-center gap-2 mt-2 text-sm text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>Password meets requirements</span>
                </div>
              )}
            </div>

            <div>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                disabled={isLoading}
                label="Confirm Password"
                error={confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined}
              />
              {confirmPassword && passwordsMatch && (
                <div className="flex items-center gap-2 mt-2 text-sm text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>Passwords match</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || !passwordValid || !passwordsMatch}
              isLoading={isLoading}
              fullWidth
              size="lg"
            >
              Sign Up
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-blue-200/70 text-sm">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-pink-400 hover:text-pink-300 font-semibold transition"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
