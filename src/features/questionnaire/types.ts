export type QuestionArchetype = 'tap' | 'preview' | 'grid' | 'swipe' | 'scrub' | 'beat';

export type ConfidenceTier = 'confirmed' | 'tapped' | 'play';

export interface PronounSet {
  she: string;
  her: string;
  hers: string;
  herself: string;
}

export interface QuestionContext {
  answers: Record<string, string | string[]>;
  pronouns: PronounSet;
  subject: 'companion' | 'friend' | 'user';
  userName?: string;
}

export interface TapOption {
  text: string;
  value?: string;
  icon?: string;
}

export interface GridOption {
  label: string;
  value: string;
  icon?: string;
  color?: string;
}

export interface SwipeCard {
  left: { label: string; icon?: string };
  right: { label: string; icon?: string };
  prompt: string;
}

export interface ScrubConfig {
  min: number;
  max: number;
  step: number;
  default: number;
  leftLabel: string;
  rightLabel: string;
  valueLabels: string[];
}

export interface PreviewBubble {
  voice: string;
  value: string;
  messages: string[];
}

export interface BeatConfig {
  template: (ctx: QuestionContext) => string;
  durationMs?: number;
}

export interface BaseQuestion {
  id: string;
  archetype: QuestionArchetype;
  question: string | ((ctx: QuestionContext) => string);
  chapter?: string;
  confidence?: ConfidenceTier;
  placeholder?: string;
}

export interface TapQuestion extends BaseQuestion {
  archetype: 'tap';
  options?: TapOption[] | ((ctx: QuestionContext) => TapOption[]);
  autoAdvance?: boolean;
}

export interface GridQuestion extends BaseQuestion {
  archetype: 'grid';
  options: GridOption[];
  multiSelect?: boolean;
  minSelections?: number;
  allowCustom?: boolean;
  columns?: number;
}

export interface SwipeQuestion extends BaseQuestion {
  archetype: 'swipe';
  cards: SwipeCard[];
}

export interface ScrubQuestion extends BaseQuestion {
  archetype: 'scrub';
  config: ScrubConfig;
}

export interface PreviewQuestion extends BaseQuestion {
  archetype: 'preview';
  bubbles: PreviewBubble[];
}

export interface BeatQuestion extends BaseQuestion {
  archetype: 'beat';
  beat: BeatConfig;
}

export type Question = TapQuestion | GridQuestion | SwipeQuestion | ScrubQuestion | PreviewQuestion | BeatQuestion;

export interface Chapter {
  id: string;
  label: string;
  questionIds: string[];
}

export interface QuestionnaireDefinition {
  questions: Question[];
  chapters: Chapter[];
  startProgress?: number;
}
