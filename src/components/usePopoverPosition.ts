import { useLayoutEffect, useState } from 'react';

const GUTTER = 12;

/**
 * Where to put a popover under its button so it always stays on screen:
 * fixed to the viewport, below the button, slid left or right as needed.
 * Recomputed on resize and rotation.
 */
export function usePopoverPosition(open: boolean, anchor: React.RefObject<HTMLElement>, width: number): React.CSSProperties {
  const [style, setStyle] = useState<React.CSSProperties>({ position: 'fixed', visibility: 'hidden' });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const w = Math.min(width, vw - GUTTER * 2);
      // Prefer lining up with the button's right edge, then keep it inside the screen.
      const left = Math.min(Math.max(GUTTER, r.right - w), vw - w - GUTTER);
      setStyle({ position: 'fixed', top: r.bottom + 8, left, width: w, maxHeight: window.innerHeight - r.bottom - 16, overflowY: 'auto' });
    };
    place();
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [open, anchor, width]);
  return style;
}
