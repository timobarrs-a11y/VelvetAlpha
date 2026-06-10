import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { onSWUpdate, applyUpdate } from '../services/swRegistration';

export function SWUpdateToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    onSWUpdate(() => setVisible(true));
  }, []);

  const handleRefresh = () => {
    applyUpdate();
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="relative bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-rose-400 via-pink-400 to-rose-400" />
            <div className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 text-rose-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">Update available</p>
                <p className="text-xs text-gray-400">Refresh to get the latest version</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleRefresh}
                  className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Refresh
                </button>
                <button
                  onClick={() => setVisible(false)}
                  className="p-1.5 text-gray-400 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
