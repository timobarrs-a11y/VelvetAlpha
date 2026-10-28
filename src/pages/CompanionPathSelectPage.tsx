import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QuestionnaireShell, HonestBridge, COMPANION_START, makeContext } from '../features/questionnaire';
import { userProfileService } from '../services/userProfileService';
import { rollRandomCandidate, saveRandomCandidate, type RandomCandidate } from '../services/randomCompanionService';
import { MatchFoundCard } from '../components/MatchFoundCard';
import { SIGNATURE_VOICES } from '../config/signatureVoices';
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
 * same shell as every question after it. Build-your-own goes on to /questionnaire. Matchmake picks everything
 * except the gender (and friend or companion) at random and shows them on a card: nothing is saved until the person
 * says yes, and "someone else" searches again.
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
  // The match is picked while the search plays but only saved once the person approves it.
  const [candidate, setCandidate] = useState<RandomCandidate | null>(null);
  const [saving, setSaving] = useState(false);

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
    const gender = answers.relationshipType === 'Male' ? 'Male' : 'Female';
    const type = answers.connectionType === 'friend' ? 'friend' : 'romantic';
    if (answers.path !== 'random') {
      navigate(`/questionnaire?gender=${gender}&type=${type}`);
      return;
    }
    setCandidate(rollRandomCandidate(gender === 'Male' ? 'male' : 'female', type));
    setPhase('searching');
  }, [navigate]);

  const handleSearchDone = useCallback(() => setPhase('reveal'), []);

  const searchAgain = () => {
    if (!candidate) return;
    setCandidate(rollRandomCandidate(candidate.gender, candidate.connection));
    setPhase('searching');
  };

  // Approved: now (and only now) the companion is saved, and the chat opens.
  const handleApprove = async () => {
    if (!candidate || saving) return;
    setSaving(true);
    try {
      const saved = await saveRandomCandidate(candidate);
      navigate(saved.to, { replace: true });
    } catch (err) {
      console.error('[companion] random match failed:', err);
      toast.error("We couldn't save your match. Please try again.");
      setSaving(false);
    }
  };

  if (phase === 'searching') {
    return <HonestBridge lines={SEARCH_LINES} onComplete={handleSearchDone} durationMs={3500} />;
  }

  if (phase === 'reveal' && candidate) {
    return (
      <div className="min-h-screen bg-[#080b14] flex items-center justify-center px-4 py-12">
        <MatchFoundCard
          name={candidate.name}
          avatar={candidate.avatar}
          voice={SIGNATURE_VOICES.find(v => v.id === candidate.voiceId)}
          isFriend={candidate.connection === 'friend'}
          saving={saving}
          onApprove={handleApprove}
          onAnother={searchAgain}
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
