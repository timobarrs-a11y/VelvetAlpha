import { useEffect, useRef, useCallback } from 'react';
import { useTutorialDirector } from '../context/TutorialDirectorContext';

export function useTutorialElement(elementId: string) {
  const ref = useRef<HTMLElement | null>(null);
  const { registerElement, activeSignal } = useTutorialDirector();

  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el;
    registerElement(elementId, el);
  }, [elementId, registerElement]);

  const isSpotlit = activeSignal?.type === 'spotlight' && activeSignal.elementId === elementId;
  const isPulsing = activeSignal?.type === 'pulse' && activeSignal.elementId === elementId;
  const isDimmed =
    activeSignal?.type === 'dim' &&
    !(activeSignal.except ?? []).includes(elementId);

  return { ref: setRef, isSpotlit, isPulsing, isDimmed };
}
