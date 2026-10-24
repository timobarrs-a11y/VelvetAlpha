import { useEffect, useRef, useState } from 'react';

/**
 * The largest square that fits its container, so a game board or canvas
 * shrinks to leave its controls on screen in a short chat window.
 */
export function useSquareFit<T extends HTMLElement>(): [React.RefObject<T>, number | null] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      setSize(Math.max(120, Math.floor(Math.min(r.width, r.height))));
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  return [ref, size];
}
