import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
}

const sizeMap: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export const ModalShell = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}: ModalShellProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeOnBackdrop ? onClose : undefined}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            className="fixed inset-0 flex items-center justify-center z-[51] p-4 pointer-events-none"
          >
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.94, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: 'spring', duration: 0.35, bounce: 0.18 }}
              className={`rounded-3xl w-full ${sizeMap[size]} max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto`}
              style={{ background: 'var(--ds-surface-3)', border: '1px solid var(--ds-border-strong)', boxShadow: 'var(--ds-shadow-modal)' }}
            >
              {title && (
                <div className="flex items-center justify-between px-6 py-5 flex-shrink-0"
                  style={{ borderBottom: '1px solid var(--ds-border-soft)' }}>
                  <h2 id="modal-title" className="text-xl font-bold text-ink font-display">{title}</h2>
                  <button
                    onClick={onClose}
                    className="ds-pill ds-pill--icon ds-pill--sm"

                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {children}
              </div>
              {footer && (
                <div className="px-6 py-4 flex-shrink-0"
                  style={{ borderTop: '1px solid var(--ds-border-soft)', background: 'var(--ds-surface-sunken)' }}>
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
