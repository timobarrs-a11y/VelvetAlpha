import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Gift, Check, AlertTriangle, Loader2, Star } from 'lucide-react';
import { StarMap } from '../components/StarMap';
import { PageHeader } from '../shared/ui/PageHeader';
import {
  PRESET_AMOUNTS,
  createDonationSession,
  verifyDonation,
  fetchUserDonations,
  type DonationStar,
} from '../services/donationService';
import { supabase } from '../shared/supabase/client';

const PRESET_OPTIONS = [...PRESET_AMOUNTS, { cents: -1, label: 'Custom' }];

export function DonationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [stars, setStars] = useState<DonationStar[]>([]);
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [newStarId, setNewStarId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [totalDonated, setTotalDonated] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const loadStars = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? null);
        const userStars = await fetchUserDonations();
        setStars(userStars);
        setTotalDonated(userStars.reduce((sum, s) => sum + s.amount_cents, 0));
      }
    } catch (err) {
      console.error('Error loading stars:', err);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadStars();
  }, [loadStars]);

  // Handle Stripe redirect back
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const donationStatus = searchParams.get('donation');

    if (sessionId && donationStatus === 'success') {
      setVerifying(true);
      verifyDonation(sessionId)
        .then(async (result) => {
          if (result.verified && result.star) {
            setSuccessMsg(
              result.duplicate
                ? 'Your star is already on the map. Thank you for your generosity!'
                : 'Your star has appeared on the map. Thank you for your gift!'
            );
            setNewStarId(result.star.id);
            await loadStars();
            setTimeout(() => setNewStarId(null), 4000);
          } else if (!result.verified) {
            setErrorMsg('Your payment could not be verified yet. If you were charged, your star will appear shortly.');
          }
        })
        .catch((err) => {
          setErrorMsg(err.message || 'Failed to verify your donation. Please contact support if you were charged.');
        })
        .finally(() => {
          setVerifying(false);
          navigate('/support', { replace: true });
        });
    } else if (donationStatus === 'cancelled') {
      setErrorMsg('Your donation was cancelled. No charge was made.');
      navigate('/support', { replace: true });
    }
  }, [searchParams, navigate, loadStars]);

  const getSelectedCents = (): number => {
    if (selectedAmount === -1) {
      const parsed = parseFloat(customAmount);
      if (isNaN(parsed) || parsed < 1) return 0;
      return Math.round(parsed * 100);
    }
    return selectedAmount;
  };

  const handleDonate = async () => {
    const cents = getSelectedCents();
    if (cents < 100) {
      setErrorMsg('Minimum donation is $1.');
      return;
    }
    setCheckoutLoading(true);
    setErrorMsg(null);
    try {
      const url = await createDonationSession(cents, message.trim() || undefined);
      window.location.href = url;
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start checkout. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const starCount = stars.length;
  const selectedCents = getSelectedCents();

  return (
    <div className="ds-page min-h-screen">
      <PageHeader
        title="Support Velvet"
        subtitle="Every gift becomes a star on your personal map"
        icon={Gift}
        accent="#fbbf24"
        width="full"
        back="/lobby"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Verification loading overlay */}
        <AnimatePresence>
          {verifying && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: 'rgba(5,7,20,0.85)', backdropFilter: 'blur(8px)' }}
            >
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
                <p className="text-white/80 text-lg font-medium">Lighting your star...</p>
                <p className="text-white/40 text-sm mt-1">Confirming your gift</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-xl flex items-start gap-3 text-emerald-300 text-sm"
              style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{successMsg}</p>
                <button onClick={() => setSuccessMsg(null)} className="text-emerald-300/60 hover:text-emerald-300 text-xs mt-1">Dismiss</button>
              </div>
            </motion.div>
          )}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-xl flex items-start gap-3 text-red-400 text-sm"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)' }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{errorMsg}</p>
                <button onClick={() => setErrorMsg(null)} className="text-red-300/60 hover:text-red-300 text-xs mt-1">Dismiss</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Star Map */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-300" fill="currentColor" />
                <span className="text-white font-semibold text-sm">
                  {starCount} {starCount === 1 ? 'star' : 'stars'}
                </span>
                {totalDonated > 0 && (
                  <span className="text-white/40 text-xs">
                    · ${(totalDonated / 100).toFixed(0)} given
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div
                className="rounded-2xl flex items-center justify-center"
                style={{ background: '#050714', minHeight: 400 }}
              >
                <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
              </div>
            ) : (
              <StarMap
                stars={stars}
                newStarId={newStarId}
                className="min-h-[400px] lg:min-h-[500px]"
              />
            )}

            <p className="text-white/30 text-xs leading-relaxed">
              Your personal constellation. Each star represents a gift you've given to help Velvet grow.
              {userEmail && !stars.length && (
                <> No stars yet — your sky is ready for its first light.</>
              )}
            </p>
          </div>

          {/* Donation panel */}
          <div className="space-y-5">
            <div
              className="rounded-2xl p-6 space-y-5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Header */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span className="text-amber-300 text-xs font-bold tracking-widest uppercase">Support Velvet</span>
                </div>
                <h2 className="text-white text-lg font-bold mb-1">Plant a star in your sky</h2>
                <p className="text-white/50 text-xs leading-relaxed">
                  One-time gift. No subscription. Every contribution helps us keep building.
                </p>
              </div>

              {/* Amount selection */}
              <div>
                <label className="block text-white/60 text-xs font-semibold mb-2 uppercase tracking-wide">Choose an amount</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_OPTIONS.map((opt) => {
                    const isActive = selectedAmount === opt.cents;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => setSelectedAmount(opt.cents)}
                        className={`py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                          isActive
                            ? 'text-white'
                            : 'text-white/50 hover:text-white/80'
                        }`}
                        style={{
                          background: isActive
                            ? 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.15))'
                            : 'rgba(255,255,255,0.05)',
                          border: isActive
                            ? '1px solid rgba(251,191,36,0.45)'
                            : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom amount input */}
              {selectedAmount === -1 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm font-medium">$</span>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      step="1"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm text-white font-medium focus:outline-none transition"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                      }}
                    />
                  </div>
                  {selectedCents > 0 && (
                    <p className="text-white/40 text-xs mt-1.5">
                      You're giving ${(selectedCents / 100).toFixed(2)}
                    </p>
                  )}
                </motion.div>
              )}

              {/* Optional message */}
              <div>
                <label className="block text-white/60 text-xs font-semibold mb-2 uppercase tracking-wide">
                  Message <span className="text-white/30 normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="A word to accompany your star..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none transition"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                />
              </div>

              {/* Donate button */}
              <button
                onClick={handleDonate}
                disabled={checkoutLoading || selectedCents < 100}
                className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #f43f6b)',
                  boxShadow: checkoutLoading ? 'none' : '0 4px 20px rgba(245,158,11,0.25)',
                }}
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirecting to checkout...
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    {selectedCents >= 100
                      ? `Give $${(selectedCents / 100).toFixed(0)}`
                      : 'Choose an amount'}
                  </>
                )}
              </button>

              {/* Trust note */}
              <p className="text-white/30 text-[11px] text-center leading-relaxed">
                Secure payment via Stripe. One-time charge — no recurring billing.
                You'll return to your star map after checkout.
              </p>
            </div>

            {/* Guest sign-in prompt */}
            {!userEmail && (
              <div
                className="rounded-xl p-4 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p className="text-white/50 text-xs leading-relaxed mb-2">
                  Already a member? Sign in to keep all your stars in one sky.
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => navigate('/login')}
                    className="text-amber-300 hover:text-amber-200 text-xs font-semibold transition"
                  >
                    Sign in
                  </button>
                  <span className="text-white/20">·</span>
                  <button
                    onClick={() => navigate('/signup')}
                    className="text-white/50 hover:text-white/80 text-xs font-semibold transition"
                  >
                    Create account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
