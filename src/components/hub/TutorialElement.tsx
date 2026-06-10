import { useEffect, useRef, ReactNode, ElementType, ComponentPropsWithoutRef } from 'react';
import { useTutorialDirector } from '../../context/TutorialDirectorContext';

type TutorialElementProps<T extends ElementType> = {
  elementId: string;
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'ref' | 'className' | 'children'>;

export function TutorialElement<T extends ElementType = 'div'>({
  elementId,
  as,
  children,
  className = '',
  ...rest
}: TutorialElementProps<T>) {
  const { activeSignal, registerElement } = useTutorialDirector();
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    registerElement(elementId, ref.current);
    return () => registerElement(elementId, null);
  }, [elementId, registerElement]);

  const isSpotlit = activeSignal?.type === 'spotlight' && activeSignal.elementId === elementId;
  const isPulsing = activeSignal?.type === 'pulse' && activeSignal.elementId === elementId;
  const isDimmed =
    activeSignal != null &&
    !isSpotlit &&
    !isPulsing &&
    (
      (activeSignal.type === 'spotlight' || activeSignal.type === 'pulse') ||
      (activeSignal.type === 'dim' && !(activeSignal.except ?? []).includes(elementId))
    );

  const Component = (as || 'div') as ElementType;

  const merged = [
    className,
    isSpotlit ? 'tutorial-spotlight' : '',
    isPulsing ? 'tutorial-pulse' : '',
    isDimmed ? 'tutorial-dimmed' : '',
  ].filter(Boolean).join(' ');

  return (
    <Component
      ref={ref}
      data-tutorial-id={elementId}
      className={merged}
      {...rest}
    >
      {children}
    </Component>
  );
}
