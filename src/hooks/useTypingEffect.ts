import { useState, useEffect } from 'react';

export const useTypingEffect = (text: string, isActive: boolean, speed: number = 50) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setDisplayedText(text);
      setIsComplete(true);
      return;
    }

    if (!text) {
      setDisplayedText('');
      setIsComplete(true);
      return;
    }

    setDisplayedText('');
    setIsComplete(false);

    const words = text.split(' ').filter(w => w.length > 0);
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex >= words.length) {
        setIsComplete(true);
        clearInterval(interval);
        return;
      }

      const word = words[currentIndex];
      if (word === undefined || word === null) {
        console.error('Word is undefined/null at index:', currentIndex, 'words array:', words);
        clearInterval(interval);
        return;
      }

      currentIndex++;
      setDisplayedText(prev => prev + (prev ? ' ' : '') + word);
    }, speed);

    return () => clearInterval(interval);
  }, [text, isActive, speed]);

  return { displayedText, isComplete };
};
