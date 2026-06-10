export interface TypingProfile {
  initialDelay: number;
  charInterval: number;
  punctuationPause: number;
}

export function calculateTypingProfile(text: string): TypingProfile {
  const length = text.length;

  if (length < 120) {
    return {
      initialDelay: 300 + Math.random() * 200,
      charInterval: 25,
      punctuationPause: 150,
    };
  }

  if (length < 300) {
    return {
      initialDelay: 600 + Math.random() * 300,
      charInterval: 30,
      punctuationPause: 200,
    };
  }

  return {
    initialDelay: 1000 + Math.random() * 400,
    charInterval: 35,
    punctuationPause: 250,
  };
}

export function calculateComposeDelayMs(text: string): number {
  const length = text.length;
  const jitter = (Math.random() - 0.5) * 200;

  if (length < 120) {
    return Math.max(250, Math.min(450, 350 + jitter));
  }

  if (length < 300) {
    return Math.max(500, Math.min(900, 700 + jitter));
  }

  const baseDelay = 900 + (length - 300) * 2;
  return Math.max(900, Math.min(2000, baseDelay + jitter));
}

export function isPunctuation(char: string): boolean {
  return /[.!?]/.test(char);
}

export function isEndOfSentence(text: string, index: number): boolean {
  if (index >= text.length - 1) return false;

  const char = text[index];
  const nextChar = text[index + 1];

  return isPunctuation(char) && nextChar === ' ';
}
