import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export type TutorialSignal =
  | { type: 'spotlight'; elementId: string }
  | { type: 'pulse'; elementId: string }
  | { type: 'dim'; except?: string[] }
  | { type: 'clear' }
  | { type: 'demo'; route: string };

export type TutorialStep =
  | 'intro'
  | 'companion'
  | 'atlas'
  | 'daily_feed'
  | 'navi'
  | 'games'
  | 'calendar'
  | 'insights'
  | 'co_author'
  | 'complete';

export type TourSource = 'first_time' | 'manual_replay' | 'feature_highlight';

export interface OnboardingMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TutorialDirectorValue {
  activeSignal: TutorialSignal | null;
  currentStep: TutorialStep;
  stepsCompleted: TutorialStep[];
  isOnboarding: boolean;
  tourSource: TourSource;
  conversation: OnboardingMessage[];

  emit: (signal: TutorialSignal) => void;
  clearSignal: () => void;
  advanceStep: (step: TutorialStep) => void;
  startTour: (source?: TourSource) => void;
  endTour: () => void;
  completeOnboarding: () => void;
  addMessage: (msg: OnboardingMessage) => void;

  registeredElements: React.MutableRefObject<Map<string, HTMLElement>>;
  registerElement: (id: string, el: HTMLElement | null) => void;
}

const TutorialDirectorContext = createContext<TutorialDirectorValue | null>(null);

export function TutorialDirectorProvider({ children }: { children: ReactNode }) {
  const [activeSignal, setActiveSignal] = useState<TutorialSignal | null>(null);
  const [currentStep, setCurrentStep] = useState<TutorialStep>('intro');
  const [stepsCompleted, setStepsCompleted] = useState<TutorialStep[]>([]);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [tourSource, setTourSource] = useState<TourSource>('first_time');
  const [conversation, setConversation] = useState<OnboardingMessage[]>([]);
  const registeredElements = useRef<Map<string, HTMLElement>>(new Map());

  const emit = useCallback((signal: TutorialSignal) => {
    setActiveSignal(signal);
    if (signal.type === 'clear') setActiveSignal(null);
  }, []);

  const clearSignal = useCallback(() => setActiveSignal(null), []);

  const advanceStep = useCallback((step: TutorialStep) => {
    setCurrentStep(step);
    setStepsCompleted(prev => (prev.includes(step) ? prev : [...prev, step]));
    if (step === 'complete') setIsOnboarding(false);
  }, []);

  const startTour = useCallback((source: TourSource = 'first_time') => {
    setTourSource(source);
    setCurrentStep('intro');
    setStepsCompleted([]);
    setConversation([]);
    setActiveSignal(null);
    setIsOnboarding(true);
  }, []);

  const endTour = useCallback(() => {
    setIsOnboarding(false);
    setActiveSignal(null);
  }, []);

  const completeOnboarding = useCallback(() => {
    setIsOnboarding(false);
    setCurrentStep('complete');
    setActiveSignal(null);
  }, []);

  const addMessage = useCallback((msg: OnboardingMessage) => {
    setConversation(prev => [...prev, msg]);
  }, []);

  const registerElement = useCallback((id: string, el: HTMLElement | null) => {
    if (el) registeredElements.current.set(id, el);
    else registeredElements.current.delete(id);
  }, []);

  return (
    <TutorialDirectorContext.Provider value={{
      activeSignal,
      currentStep,
      stepsCompleted,
      isOnboarding,
      tourSource,
      conversation,
      emit,
      clearSignal,
      advanceStep,
      startTour,
      endTour,
      completeOnboarding,
      addMessage,
      registeredElements,
      registerElement,
    }}>
      {children}
    </TutorialDirectorContext.Provider>
  );
}

export function useTutorialDirector() {
  const ctx = useContext(TutorialDirectorContext);
  if (!ctx) throw new Error('useTutorialDirector must be used within TutorialDirectorProvider');
  return ctx;
}
