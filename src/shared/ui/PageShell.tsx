import { ReactNode } from 'react';

type Width = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

const WIDTH: Record<Width, string> = {
  sm:   'max-w-md',
  md:   'max-w-2xl',
  lg:   'max-w-4xl',
  xl:   'max-w-6xl',
  '2xl':'max-w-7xl',
  full: 'max-w-full',
};

interface PageShellProps {
  children: ReactNode;
  /** Sticky header rendered above the content (usually <PageHeader />). */
  header?: ReactNode;
  /** Max content width. Defaults to `xl` (72rem). */
  width?: Width;
  /** Apply horizontal + vertical padding to the content column. Default true. */
  padded?: boolean;
  /** Use a fixed viewport-height flex column (chat-style screens). */
  fullHeight?: boolean;
  /** Center content both ways — for loading / empty / auth-style screens. */
  center?: boolean;
  className?: string;
  contentClassName?: string;
}

/**
 * Root container for every non-companion screen.
 * Paints the design-system page background + ambient glow and lays out an
 * optional sticky header above a width-constrained content column.
 */
export function PageShell({
  children,
  header,
  width = 'xl',
  padded = true,
  fullHeight = false,
  center = false,
  className = '',
  contentClassName = '',
}: PageShellProps) {
  const rootLayout = fullHeight
    ? 'h-screen h-[100dvh] flex flex-col overflow-hidden'
    : center
      ? 'flex flex-col'
      : '';

  const content = center ? (
    <div className={`flex-1 flex items-center justify-center ${padded ? 'p-4 sm:p-6' : ''} ${contentClassName}`}>
      {children}
    </div>
  ) : (
    <div
      className={`w-full ${WIDTH[width]} mx-auto ${padded ? 'px-4 sm:px-6 py-6 sm:py-8' : ''} ${fullHeight ? 'flex-1 min-h-0 flex flex-col' : ''} ${contentClassName}`}
    >
      {children}
    </div>
  );

  return (
    <div className={`ds-page ${rootLayout} ${className}`}>
      {header}
      {content}
    </div>
  );
}
