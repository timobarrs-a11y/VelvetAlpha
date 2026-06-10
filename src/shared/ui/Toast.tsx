import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

let listeners: Array<(t: ToastMessage) => void> = [];

function emit(message: string, type: ToastType, duration = 5000) {
  const t: ToastMessage = { id: `${Date.now()}-${Math.random()}`, message, type, duration };
  listeners.forEach(fn => fn(t));
}

export const toast = {
  success: (msg: string, duration?: number) => emit(msg, 'success', duration),
  error:   (msg: string, duration?: number) => emit(msg, 'error',   duration),
  info:    (msg: string, duration?: number) => emit(msg, 'info',    duration),
  warning: (msg: string, duration?: number) => emit(msg, 'warning', duration),
};

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2  className="w-4 h-4 text-success-600 flex-shrink-0" />,
  error:   <AlertCircle   className="w-4 h-4 text-danger-600  flex-shrink-0" />,
  info:    <Info          className="w-4 h-4 text-info-600    flex-shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-warning-600 flex-shrink-0" />,
};

const borderMap: Record<ToastType, string> = {
  success: 'border-success-200',
  error:   'border-danger-200',
  info:    'border-info-200',
  warning: 'border-warning-200',
};

const accentMap: Record<ToastType, string> = {
  success: 'bg-success-500',
  error:   'bg-danger-500',
  info:    'bg-info-500',
  warning: 'bg-warning-500',
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (t: ToastMessage) => {
      setToasts(prev => [...prev.slice(-4), t]);
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, t.duration ?? 5000);
    };
    listeners.push(handler);
    return () => { listeners = listeners.filter(fn => fn !== handler); };
  }, []);

  const dismiss = (id: string) => setToasts(prev => prev.filter(x => x.id !== id));

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 w-[340px] pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: 8,   scale: 0.95, transition: { duration: 0.15 } }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            role="alert"
            className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 px-4 py-3.5 rounded-2xl border bg-white shadow-modal ${borderMap[t.type]}`}
          >
            <div className={`absolute top-0 left-0 w-1 h-full rounded-l-2xl ${accentMap[t.type]}`} />
            <div className="mt-0.5 ml-1">{iconMap[t.type]}</div>
            <p className="text-sm text-ink leading-snug flex-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-ink-subtle hover:text-ink transition-colors flex-shrink-0 mt-0.5 p-0.5 hover:bg-surface-100 rounded-lg"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
