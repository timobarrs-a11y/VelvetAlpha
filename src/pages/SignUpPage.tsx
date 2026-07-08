import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Heart, ShieldCheck, ChevronDown } from 'lucide-react';
import { authService } from '../services/authService';
import { Button, Input } from '../shared/ui';

const TERMS_VERSION = '2026-01-28';
const VELVET_BG = 'linear-gradient(175deg, #1e2a7a 0%, #141a55 40%, #0d0f3c 100%)';
const VELVET_RADIAL = `radial-gradient(ellipse 90% 50% at 50% -5%, rgba(80,100,255,0.30) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 20% 110%, rgba(244,63,107,0.12) 0%, transparent 50%)`;

const MONTHS = [
  { value: '01', label: 'January' }, { value: '02', label: 'February' },
  { value: '03', label: 'March' }, { value: '04', label: 'April' },
  { value: '05', label: 'May' }, { value: '06', label: 'June' },
  { value: '07', label: 'July' }, { value: '08', label: 'August' },
  { value: '09', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

function calcAge(month: string, day: string, year: string): number | null {
  if (!month || !day || !year || year.length < 4) return null;
  const birth = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}

function StyledSelect({ value, onChange, options, placeholder, disabled }: SelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-xl px-4 py-3 pr-10 text-sm font-medium transition-all outline-none"
        style={{
          background: value ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${value ? 'rgba(100,120,255,0.50)' : 'rgba(255,255,255,0.12)'}`,
          color: value ? 'white' : 'rgba(180,190,255,0.55)',
        }}
      >
        <option value="" disabled style={{ background: '#141a55', color: 'rgba(180,190,255,0.55)' }}>{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#141a55', color: 'white' }}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(180,190,255,0.50)' }} />
    </div>
  );
}

export default function SignUpPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const dayOptions = Array.from({ length: 31 }, (_, i) => {
    const d = (i + 1).toString().padStart(2, '0');
    return { value: d, label: d };
  });
  const yearOptions = Array.from({ length: 100 }, (_, i) => {
    const y = (currentYear - i).toString();
    return { value: y, label: y };
  });

  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirmPassword && confirmPassword !== '';
  const age = calcAge(birthMonth, birthDay, birthYear);
  const dobComplete = birthMonth && birthDay && birthYear && birthYear.length === 4;
  const isAdult = age !== null && age >= 18;
  const dobError = dobComplete && !isAdult;
  const canSubmit = email && passwordValid && passwordsMatch && dobComplete && isAdult && termsAccepted && privacyAccepted;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!dobComplete) { setError('Please enter your complete date of birth.'); return; }
    if (!isAdult) { setError('You must be 18 years or older to create an account.'); return; }
    if (!termsAccepted || !privacyAccepted) { setError('You must accept the Terms of Service and Privacy Policy to continue.'); return; }
    if (!passwordValid) { setError('Password must be at least 8 characters long.'); return; }
    if (!passwordsMatch) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    try {
      await authService.signUp(email, password, {
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: new Date().toISOString(),
        ageVerifiedAt: new Date().toISOString(),
        birthday: `${birthYear}-${birthMonth}-${birthDay}`,
      });
      navigate('/welcome');
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
            <p className="text-blue-200/70 text-sm">Project the world you want around you</p>
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
                placeholder="Create a password (8+ characters)"
                required
                disabled={isLoading}
                label="Password"
                error={password && !passwordValid ? 'Password must be at least 8 characters' : undefined}
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

            {/* Age Verification */}
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-blue-300" />
                <span className="text-sm font-semibold text-blue-200">Age Verification</span>
                <span className="text-xs text-blue-200/50 ml-auto">18+ only</span>
              </div>
              <p className="text-xs text-blue-200/50 leading-relaxed">
                Project Velvet contains mature content. You must be 18 or older to create an account. Your date of birth is used solely to verify eligibility.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <StyledSelect
                  value={birthMonth}
                  onChange={setBirthMonth}
                  options={MONTHS}
                  placeholder="Month"
                  disabled={isLoading}
                />
                <StyledSelect
                  value={birthDay}
                  onChange={setBirthDay}
                  options={dayOptions}
                  placeholder="Day"
                  disabled={isLoading}
                />
                <StyledSelect
                  value={birthYear}
                  onChange={setBirthYear}
                  options={yearOptions}
                  placeholder="Year"
                  disabled={isLoading}
                />
              </div>
              {dobComplete && isAdult && (
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>Age verified</span>
                </div>
              )}
              {dobError && (
                <p className="text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  You must be 18 or older to use this service.
                </p>
              )}
            </div>

            {/* Legal Consent */}
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    disabled={isLoading}
                    className="sr-only"
                  />
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center transition-all"
                    style={{
                      background: termsAccepted ? 'rgba(244,63,107,0.85)' : 'rgba(255,255,255,0.08)',
                      border: termsAccepted ? '1px solid rgba(244,63,107,0.80)' : '1px solid rgba(255,255,255,0.20)',
                    }}
                  >
                    {termsAccepted && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  </div>
                </div>
                <span className="text-sm text-blue-100/80 leading-relaxed">
                  I have read and agree to the{' '}
                  <button
                    type="button"
                    onClick={() => window.open('/terms', '_blank')}
                    className="text-pink-400 hover:text-pink-300 underline underline-offset-2 font-medium"
                  >
                    Terms of Service
                  </button>{' '}
                  (version {TERMS_VERSION})
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    disabled={isLoading}
                    className="sr-only"
                  />
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center transition-all"
                    style={{
                      background: privacyAccepted ? 'rgba(244,63,107,0.85)' : 'rgba(255,255,255,0.08)',
                      border: privacyAccepted ? '1px solid rgba(244,63,107,0.80)' : '1px solid rgba(255,255,255,0.20)',
                    }}
                  >
                    {privacyAccepted && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  </div>
                </div>
                <span className="text-sm text-blue-100/80 leading-relaxed">
                  I have read and agree to the{' '}
                  <button
                    type="button"
                    onClick={() => window.open('/privacy', '_blank')}
                    className="text-pink-400 hover:text-pink-300 underline underline-offset-2 font-medium"
                  >
                    Privacy Policy
                  </button>{' '}
                  and consent to data processing as described.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !canSubmit}
              isLoading={isLoading}
              fullWidth
              size="lg"
            >
              Create Account
            </Button>

            <p className="text-center text-xs text-blue-200/40 leading-relaxed px-2">
              By creating an account, you confirm you are 18 or older and consent to our Terms of Service and Privacy Policy. Your age verification is recorded.
            </p>
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
