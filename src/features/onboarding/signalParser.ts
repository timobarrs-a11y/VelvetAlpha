import { TutorialSignal, TutorialStep } from '../../context/TutorialDirectorContext';

export interface ParsedAtlasResponse {
  cleanText: string;
  signals: TutorialSignal[];
  stepAdvance: TutorialStep | null;
}

const SIGNAL_PATTERN = /\[([A-Z_]+):([^\]]*)\]/g;

const VALID_SIGNALS = new Set(['SPOTLIGHT', 'PULSE', 'DIM', 'CLEAR', 'DEMO', 'STEP']);

const STEP_MAP: Record<string, TutorialStep> = {
  intro: 'intro',
  companion: 'companion',
  atlas: 'atlas',
  daily_feed: 'daily_feed',
  navi: 'navi',
  games: 'games',
  calendar: 'calendar',
  insights: 'insights',
  co_author: 'co_author',
  complete: 'complete',
};

export function parseAtlasResponse(raw: string): ParsedAtlasResponse {
  const signals: TutorialSignal[] = [];
  let stepAdvance: TutorialStep | null = null;

  const cleanText = raw.replace(SIGNAL_PATTERN, (match, type, value) => {
    if (!VALID_SIGNALS.has(type)) return match;

    const trimmed = value.trim().toLowerCase();

    switch (type) {
      case 'SPOTLIGHT':
        signals.push({ type: 'spotlight', elementId: trimmed });
        break;
      case 'PULSE':
        signals.push({ type: 'pulse', elementId: trimmed });
        break;
      case 'DIM': {
        const except = trimmed ? trimmed.split(',').map((s: string) => s.trim()) : undefined;
        signals.push({ type: 'dim', except });
        break;
      }
      case 'CLEAR':
        signals.push({ type: 'clear' });
        break;
      case 'DEMO':
        signals.push({ type: 'demo', route: trimmed });
        break;
      case 'STEP':
        if (STEP_MAP[trimmed]) {
          stepAdvance = STEP_MAP[trimmed];
        }
        break;
    }

    return '';
  }).replace(/\s{2,}/g, ' ').trim();

  return { cleanText, signals, stepAdvance };
}
