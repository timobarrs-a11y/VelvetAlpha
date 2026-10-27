export type QuestionArchetype = 'tap' | 'preview' | 'grid' | 'swipe' | 'scrub' | 'beat' | 'tabs';

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
  confirmLabel?: string;
  accentColor?: string;
}

export interface BaseQuestion {
  id: string;
  archetype: QuestionArchetype;
  question: string | ((ctx: QuestionContext) => string);
  chapter?: string;
  confidence?: ConfidenceTier;
  placeholder?: string;
  /** Resuming never passes over this question, even when later ones are answered. */
  required?: boolean;
  /** Skip this question when true, going forward and back (a cusp question off a cusp, a birthday we already have). */
  skipIf?: (ctx: QuestionContext) => boolean;
}

export interface TapQuestion extends BaseQuestion {
  archetype: 'tap';
  options?: TapOption[] | ((ctx: QuestionContext) => TapOption[]);
  autoAdvance?: boolean;
  minLength?: number;
  optional?: boolean;
  skipLabel?: string;
  /** A small line under the answer box (what we do with it, why it is optional). */
  hint?: string | ((ctx: QuestionContext) => string);
  /** Why an answer is not allowed, or null when it is fine. The Next button waits for null. */
  validate?: (text: string) => string | null;
  /** Show the nickname bank to choose one from (or they type their own); the skip button gives them a random one. */
  nicknameBank?: boolean;
  /** Tappable suggestions that fill the answer box; they can still type their own. */
  suggestions?: string[];
}

export interface GridQuestion extends BaseQuestion {
  archetype: 'grid';
  options: GridOption[];
  multiSelect?: boolean;
  minSelections?: number;
  allowCustom?: boolean;
  columns?: number;
}

/** One tab of a tabbed screen: its picks are saved under `answerKey`. */
export interface TabsTab {
  id: string;
  label: string;
  /** A line that brings a memory forward ("Something you'd regret never doing"). */
  nudge?: string;
  answerKey: string;
  options: GridOption[];
  allowCustom?: boolean;
}

/** Several multi-select groups on one screen, as tabs (interests, Someday). */
export interface TabsQuestion extends BaseQuestion {
  archetype: 'tabs';
  subtitle?: string;
  tabs: TabsTab[];
  /** Picks needed across all tabs before Next; 0 makes the screen optional. */
  minSelections?: number;
  skipLabel?: string;
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

export type Question = TapQuestion | GridQuestion | SwipeQuestion | ScrubQuestion | PreviewQuestion | BeatQuestion | TabsQuestion;

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
