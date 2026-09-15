import { useState, useEffect, useRef, useCallback } from 'react';

const SHORT_MESSAGE_THRESHOLD = 40;

interface TypingEffectOptions {
  speed?: number;
  onComplete?: () => void;
}

interface TypingEffectResult {
  displayedText: string;
  isComplete: boolean;
  showCursor: boolean;
}

export const useTypingEffect = (
  text: string,
  isActive: boolean,
  speedOrOptions: number | TypingEffectOptions = 50,
): TypingEffectResult => {
  const speed = typeof speedOrOptions === 'number' ? speedOrOptions : (speedOrOptions.speed ?? 50);
  const onComplete = typeof speedOrOptions === 'number' ? undefined : speedOrOptions.onComplete;

  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [showCursor, setShowCursor] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!isActive) {
      setDisplayedText(text);
      setIsComplete(true);
      setShowCursor(false);
      return;
    }

    if (!text) {
      setDisplayedText('');
      setIsComplete(true);
      setShowCursor(false);
      return;
    }

    setDisplayedText('');
    setIsComplete(false);
    setShowCursor(true);

    const words = text.split(' ').filter(w => w.length > 0);
    const isShort = words.length <= SHORT_MESSAGE_THRESHOLD;

    if (!isShort) {
      setDisplayedText(text);
      setIsComplete(true);
      setShowCursor(false);
      onCompleteRef.current?.();
      return;
    }

    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex >= words.length) {
        setIsComplete(true);
        setTimeout(() => setShowCursor(false), 600);
        clearInterval(interval);
        onCompleteRef.current?.();
        return;
      }

      const word = words[currentIndex];
      if (word === undefined || word === null) {
        clearInterval(interval);
        return;
      }

      currentIndex++;
      setDisplayedText(prev => prev + (prev ? ' ' : '') + word);
    }, speed);

    return () => clearInterval(interval);
  }, [text, isActive, speed]);

  return { displayedText, isComplete, showCursor };
};

export function useWritingIndicator(isThinking: boolean, delayMs = 4000) {
  const [label, setLabel] = useState('Atlas is writing...');

  useEffect(() => {
    if (!isThinking) {
      setLabel('Atlas is writing...');
      return;
    }
    setLabel('Atlas is writing...');
    const timer = setTimeout(() => setLabel('Atlas is still writing...'), delayMs);
    return () => clearTimeout(timer);
  }, [isThinking, delayMs]);

  return label;
}
