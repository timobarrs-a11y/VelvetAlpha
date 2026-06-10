import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
  animate?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padded?: boolean;
}

const maxWidthMap: Record<string, string> = {
  sm:   'max-w-sm',
  md:   'max-w-2xl',
  lg:   'max-w-4xl',
  xl:   'max-w-6xl',
  '2xl':'max-w-7xl',
  full: 'max-w-full',
};

export function PageWrapper({
  children,
  className = '',
  animate = true,
  maxWidth = 'xl',
  padded = true,
}: PageWrapperProps) {
  const inner = (
    <div className={`w-full ${maxWidthMap[maxWidth]} mx-auto ${padded ? 'px-4 sm:px-6 py-6 sm:py-8' : ''} ${className}`}>
      {children}
    </div>
  );

  if (!animate) return <div className="page-container">{inner}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="page-container"
    >
      {inner}
    </motion.div>
  );
}
