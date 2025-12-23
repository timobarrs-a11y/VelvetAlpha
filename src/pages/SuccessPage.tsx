import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { supabase } from '../services/supabase';
import { SubscriptionTier, SUBSCRIPTION_PLANS } from '../types/subscription';
import { addMessagesToUser } from '../services/messageTrackingService';

export function SuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    handleSuccess();
  }, []);

  const handleSuccess = async () => {
    try {
      const tier = searchParams.get('tier') as SubscriptionTier;
      const sessionId = searchParams.get('session_id');

      if (!tier || !sessionId) {
        setError('Invalid payment session');
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate('/');
        return;
      }

      const plan = SUBSCRIPTION_PLANS[tier];
      if (!plan) {
        setError('Invalid tier');
        setLoading(false);
        return;
      }

      const success = await addMessagesToUser(user.id, plan.messageLimit || 0, tier);

      if (!success) {
        setError('Failed to update subscription');
      }

      setLoading(false);

      setTimeout(() => {
        navigate('/lobby');
      }, 3000);
    } catch (err) {
      console.error('Error processing payment:', err);
      setError('Something went wrong');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-rose-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-rose-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-white text-lg">Processing your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-rose-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Payment Error</h1>
          <p className="text-gray-300 mb-8">{error}</p>
          <button
            onClick={() => navigate('/lobby')}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-8 rounded-lg transition"
          >
            Go to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-black to-rose-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="relative mb-8"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full flex items-center justify-center mx-auto shadow-2xl">
            <CheckCircle2 className="text-white" size={56} />
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="absolute -top-2 -right-2"
          >
            <Sparkles className="text-yellow-400" size={32} />
          </motion.div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-5xl font-bold text-white mb-4"
        >
          Welcome to Velvet! 🎉
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="text-xl text-gray-300 mb-8"
        >
          Your payment was successful
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-sm text-gray-400 mb-8"
        >
          Redirecting you to start chatting...
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          onClick={() => navigate('/lobby')}
          className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all"
        >
          Start Chatting Now
        </motion.button>
      </motion.div>
    </div>
  );
}
