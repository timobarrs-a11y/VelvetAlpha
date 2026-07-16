import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../shared/supabase/client';
import { SUBSCRIPTION_PLANS } from '../types/subscription';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { toast } from '../shared/ui/Toast';

export function PricingOfferPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkIfShouldSkip();
  }, []);

  const checkIfShouldSkip = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.subscription_tier && profile.subscription_tier !== 'free') {
      const companionId = sessionStorage.getItem('currentCompanionId');
      if (companionId) {
        navigate(`/chat?companion=${companionId}`, { replace: true });
      } else {
        navigate('/lobby', { replace: true });
      }
    }
  };


  const handleContinueFree = async () => {
    setLoading(true);
    try {
      const companionId = sessionStorage.getItem('currentCompanionId');

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Authentication error. Please refresh the page and try again.');
        setLoading(false);
        return;
      }

      if (companionId) {
        navigate(`/chat?companion=${companionId}`, { replace: true });
      } else {
        navigate('/lobby', { replace: true });
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleUpgradeToPremium = async () => {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error('Please sign in to upgrade your subscription');
        setLoading(false);
        return;
      }

      if (!premiumPlan.stripePriceId) {
        toast.error('This subscription plan is not available yet');
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to continue');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            tier: premiumPlan.tier,
            priceId: premiumPlan.stripePriceId
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Error upgrading to premium:', error);
      toast.error(error instanceof Error ? error.message : 'There was an error processing your request. Please try again.');
      setLoading(false);
    }
  };

  const premiumPlan = SUBSCRIPTION_PLANS.plus;
  const freePlan = SUBSCRIPTION_PLANS.free;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-rose-900 text-white overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex justify-end mb-6">
          <button
            onClick={handleContinueFree}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl transition-all shadow-xl hover:shadow-2xl hover:scale-105"
            aria-label="Skip to app"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-purple-500 mb-6">
            <Sparkles className="w-8 h-8" />
          </div>

          <h1 className="text-5xl font-bold mb-4">
            Unlock The Full Experience
          </h1>

          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Chat freely every day, with premium voices and exclusive features
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {premiumPlan && (
            <div className="relative bg-gradient-to-b from-rose-900/40 to-purple-900/40 border-2 border-rose-500 rounded-2xl p-8 shadow-2xl shadow-rose-500/20">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-rose-500 to-purple-500 text-white px-6 py-2 rounded-full text-sm font-bold">
                  RECOMMENDED
                </span>
              </div>

              <div className="text-center mb-6">
                <h3 className="text-3xl font-bold mb-2">{premiumPlan.name}</h3>
                <div className="flex items-end justify-center gap-2">
                  <span className="text-5xl font-bold">${premiumPlan.price}</span>
                  <span className="text-gray-300 mb-2">/month</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {premiumPlan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="text-green-400 mt-1 text-xl">✓</span>
                    <span className="text-lg">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={handleUpgradeToPremium}
                disabled={loading}
                className="block w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-rose-500 to-purple-500 hover:from-rose-600 hover:to-purple-600 text-white shadow-lg shadow-rose-500/30 transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Upgrade to Premium'}
              </button>
            </div>
          )}

          {freePlan && (
            <div className="bg-gradient-to-b from-gray-800/40 to-gray-900/40 border-2 border-gray-600 rounded-2xl p-8">
              <div className="text-center mb-6">
                <h3 className="text-3xl font-bold mb-2">{freePlan.name}</h3>
                <div className="flex items-end justify-center gap-2">
                  <span className="text-5xl font-bold">${freePlan.price}</span>
                  <span className="text-gray-300 mb-2">/month</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {freePlan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-300">
                    <span className="text-gray-500 mt-1 text-xl">✓</span>
                    <span className="text-lg">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={handleContinueFree}
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-lg bg-gray-700 hover:bg-gray-600 text-white transition-all inline-flex items-center justify-center gap-2"
              >
                {loading ? 'Loading...' : 'Continue with Free'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <div className="text-center text-gray-400">
          <p className="text-sm">You can upgrade to premium anytime from settings</p>
        </div>
      </div>
    </div>
  );
}
