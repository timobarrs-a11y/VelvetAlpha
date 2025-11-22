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

    console.log('useTypingEffect - input text:', text);
    console.log('useTypingEffect - text ends with undefined:', text?.endsWith('undefined'));

    setDisplayedText('');
    setIsComplete(false);

    const words = text.split(' ');
    console.log('useTypingEffect - words array:', words);
    console.log('useTypingEffect - last word:', words[words.length - 1]);
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < words.length) {
        setDisplayedText(prev => {
          const word = words[currentIndex];
          if (word === undefined || word === null) {
            console.error('Word is undefined/null at index:', currentIndex, 'words array:', words);
            return prev;
          }
          const newText = prev + (prev ? ' ' : '') + word;
          return newText;
        });
        currentIndex++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, isActive, speed]);

  return { displayedText, isComplete };
};
