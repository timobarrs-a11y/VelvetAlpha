import type { ReactNode } from 'react';

/**
 * A live preview that stays on screen while the options below it scroll, so changing a color or a
 * style is never done blind. Use it on any editor where the thing you are changing is drawn above the
 * things you change it with (the avatar, the house).
 *
 * It only works if nothing between it and the page is a scroller of its own: `overflow-y-auto`,
 * `overflow-hidden` or `overscroll-contain` on an ancestor that is not given a fixed height both stops
 * the strip from sticking and swallows a finger's swipe, so the page seems stuck. Put the editor in the
 * page and let the page scroll. The tests in PinnedPreview.test.tsx check this for each use.
 *
 * `controls` sit beside the preview (shuffle, undo), and `tabs` go under it, inside the pinned strip.
 */
export function PinnedPreview({ preview, controls, tabs, children, background = '#080b14', className = '' }: {
  preview: ReactNode;
  controls?: ReactNode;
  tabs?: ReactNode;
  children: ReactNode;
  /** The page color behind the strip, so options scroll away underneath it cleanly. */
  background?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div
        data-pinned-preview
        className="sticky top-0 z-20 pb-3 pt-2"
        style={{ background: `linear-gradient(to bottom, ${background} 85%, ${background}00)` }}
      >
        <div className="flex items-center justify-center gap-4">
          {preview}
          {controls}
        </div>
        {tabs}
      </div>
      {children}
    </div>
  );
}
