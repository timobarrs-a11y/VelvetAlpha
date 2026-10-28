import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QuestionnaireShell, HonestBridge, COMPANION_START, makeContext } from '../features/questionnaire';
import { userProfileService } from '../services/userProfileService';
import { createRandomCompanion, type RandomCompanion } from '../services/randomCompanionService';
import { AvatarSaveReveal } from '../components/AvatarSaveReveal';
import { DEZ } from '../features/questionnaire/dez';
import { toast } from '../shared/ui/Toast';

type Phase = 'ask' | 'searching' | 'reveal';

const SEARCH_LINES = [
  { text: 'Let me see who is on my list...' },
  { text: 'Oh, I know just the one.' },
  { text: 'Hang on, they are on their way.' },
];

/**
 * Where making someone starts: gender, then friend or companion, then build your own or be surprised, all in the
 * same shell as every question after it. Build-your-own goes on to /questionnaire. Surprise-me makes everything
 * except the gender (and friend or companion) at random, shows them for the first time, and ends in the chat.
 */
export function CompanionPathSelectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const kindParam = searchParams.get('kind');
  const preset = kindParam === 'friend' || kindParam === 'romantic' ? kindParam : null;

  const initialAnswers = useMemo<Record<string, string>>(
    (): Record<string, string> => (preset ? { connectionType: preset, kindPreset: '1' } : {}),
    [preset],
  );
  const [phase, setPhase] = useState<Phase>('ask');
  const [liveAnswers, setLiveAnswers] = useState<Record<string, string | string[]>>(initialAnswers);
  const [profileName, setProfileName] = useState<string | undefined>(undefined);
  const [match, setMatch] = useState<RandomCompanion | null>(null);
  // The companion is made while the search plays, so the reveal waits for both.
  const creating = useRef<Promise<RandomCompanion> | null>(null);
  const picked = useRef<Record<string, string | string[]>>({});

  useEffect(() => {
    userProfileService.getCurrentProfile().then(p => { if (p?.name) setProfileName(p.name); }).catch(() => {});
  }, []);

  const connection = (liveAnswers.connectionType as string) || '';
  const ctx = useMemo(
    () => makeContext(liveAnswers, (liveAnswers.relationshipType as string) || '', connection === 'friend' ? 'friend' : 'companion', profileName),
    [liveAnswers, connection, profileName],
  );

  const handleAnswer = useCallback((_id: string, _answer: string | string[], all: Record<string, string | string[]>) => {
    setLiveAnswers(all);
  }, []);

  const handleComplete = useCallback((answers: Record<string, string | string[]>) => {
    picked.current = answers;
    const gender = answers.relationshipType === 'Male' ? 'Male' : 'Female';
    const type = answers.connectionType === 'friend' ? 'friend' : 'romantic';
    if (answers.path !== 'random') {
      navigate(`/questionnaire?gender=${gender}&type=${type}`);
      return;
    }
    creating.current = createRandomCompanion(gender === 'Male' ? 'male' : 'female', type);
    // Failures are handled when the search ends; keep an early one from being reported as unhandled.
    creating.current.catch(() => {});
    setPhase('searching');
  }, [navigate]);

  const handleSearchDone = useCallback(async () => {
    try {
      setMatch(await creating.current!);
      setPhase('reveal');
    } catch (err) {
      console.error('[companion] random match failed:', err);
      toast.error("We couldn't create your match. Please try again.");
      setPhase('ask');
    }
  }, []);

  if (phase === 'searching') {
    return <HonestBridge lines={SEARCH_LINES} onComplete={handleSearchDone} durationMs={3500} />;
  }

  if (phase === 'reveal' && match) {
    return (
      <div className="min-h-screen bg-[#080b14]">
        <AvatarSaveReveal
          config={match.avatar}
          companionName={match.name}
          isCompanion
          headline={`Meet ${match.name}.`}
          subline="Your match is ready. Say hello."
          buttonLabel="Start chatting"
          autoDismissMs={0}
          onContinue={() => navigate(match.to, { replace: true })}
        />
      </div>
    );
  }

  return (
    <QuestionnaireShell
      host={DEZ}
      reactionCount={1}
      definition={COMPANION_START}
      context={ctx}
      initialAnswers={initialAnswers}
      onComplete={handleComplete}
      onAnswer={handleAnswer}
      onBack={() => navigate(-1)}
    />
  );
}
