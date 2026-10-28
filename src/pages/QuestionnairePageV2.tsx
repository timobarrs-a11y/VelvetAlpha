import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QuestionnaireShell, HonestBridge, PresenceOrb, COMPANION_QUESTIONNAIRE, makeContext } from '../features/questionnaire';
import type { QuestionnaireDefinition } from '../features/questionnaire';
import { DEZ } from '../features/questionnaire/dez';
import { supabase } from '../shared/supabase/client';
import { userProfileService } from '../services/userProfileService';
import { createCompanionFromAnswers } from '../services/companionFromAnswers';
import { toast } from '../shared/ui/Toast';

const HUE_MAP: Record<string, string> = {
  Female: '#ec4899',
  Male: '#3b82f6',
};

/**
 * "Create your own": the companion questionnaire. Who they want (gender) and friend or companion are chosen on the
 * screens before it, so they are not asked again. "From inside the Velvet Rope" never comes here at all: it makes
 * the companion on the choice screen and goes straight to the chat.
 */
const WITHOUT_CHOSEN: QuestionnaireDefinition = {
  ...COMPANION_QUESTIONNAIRE,
  chapters: COMPANION_QUESTIONNAIRE.chapters.filter(c => c.id !== 'connection'),
  questions: COMPANION_QUESTIONNAIRE.questions.filter(q => q.id !== 'relationshipType' && q.id !== 'connectionType'),
};

function buildCompanionBridgeLines(answers: Record<string, string | string[]>): { text: string }[] {
  const name = answers.companionName as string;
  const pronoun = answers.relationshipType === 'Male' ? 'him' : 'her';
  const humor = Array.isArray(answers.humor) ? answers.humor[0] : (answers.humor as string);
  const humorLines: Record<string, string> = {
    witty: `Teaching ${pronoun} to land a good line...`,
    goofy: `Teaching ${pronoun} to be ridiculous on purpose...`,
    dry: `Teaching ${pronoun} to say it with a straight face...`,
    warm: `Teaching ${pronoun} to make you feel at home...`,
  };
  const lines: { text: string }[] = [];
  if (humor) lines.push({ text: humorLines[humor] ?? `Teaching ${pronoun} to text the way you liked...` });
  lines.push({ text: name ? `Setting up ${name}...` : `Setting ${pronoun} up...` });
  return lines;
}

export function QuestionnairePageV2() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const genderParam = searchParams.get('gender');
  const typeParam = searchParams.get('type');
  const chosen = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (genderParam === 'Male' || genderParam === 'Female') out.relationshipType = genderParam;
    if (typeParam === 'friend' || typeParam === 'romantic') out.connectionType = typeParam;
    return out;
  }, [genderParam, typeParam]);
  const hasChosen = !!chosen.relationshipType && !!chosen.connectionType;

  // Two or three remarks in the whole of making someone: one on the first screens (see CompanionPathSelectPage), one or two here.
  const buildRemarks = useMemo(() => (Math.random() < 0.5 ? 1 : 2), []);
  const [showBridge, setShowBridge] = useState(false);
  const [bridgeAnswers, setBridgeAnswers] = useState<Record<string, string | string[]>>({});
  const [liveAnswers, setLiveAnswers] = useState<Record<string, string | string[]>>(chosen);
  const [profileName, setProfileName] = useState<string | undefined>(undefined);

  // The old random link (?mode=velvet) and a visit with nothing chosen both start over at the choice screen:
  // the order is friend or companion, then male or female, then your own or random.
  const startOver = searchParams.get('mode') === 'velvet' || !hasChosen;
  useEffect(() => {
    if (startOver) navigate('/companion-path', { replace: true });
  }, [startOver, navigate]);

  useEffect(() => {
    userProfileService.getCurrentProfile()
      .then(p => { if (p?.name) setProfileName(p.name); })
      .catch(() => {});
  }, []);

  const gender = (liveAnswers.relationshipType as string) || '';
  const connectionType = (liveAnswers.connectionType as string) || '';
  const userName = profileName || undefined;

  const ctx = useMemo(
    () => makeContext(liveAnswers, gender, connectionType === 'friend' ? 'friend' : 'companion', userName),
    [liveAnswers, gender, connectionType, userName]
  );

  const hue = HUE_MAP[gender] || '#ec4899';
  const energy = (() => {
    const e = liveAnswers.energy as string;
    if (e === 'Life of the party') return 2;
    if (e === 'In her own world' || e === 'In his own world') return 0;
    return 1;
  })();

  const traitChips = useMemo(() => {
    const humor = liveAnswers.humor;
    const first = Array.isArray(humor) ? humor[0] : humor;
    return first ? [first as string] : [];
  }, [liveAnswers]);

  const orbLabel = (liveAnswers.companionName as string) || undefined;

  const renderOrb = useCallback(
    () => <PresenceOrb hue={hue} energy={energy} traitChips={traitChips} label={orbLabel} size={100} />,
    [hue, energy, traitChips, orbLabel]
  );

  const handleComplete = useCallback(async (answers: Record<string, string | string[]>) => {
    setBridgeAnswers({ ...chosen, ...answers });
    setShowBridge(true);
  }, [chosen]);

  const handleAnswer = useCallback((_questionId: string, _answer: string | string[], allAnswers: Record<string, string | string[]>) => {
    setLiveAnswers(allAnswers);
  }, []);

  const handleBridgeComplete = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Your session expired. Please sign in again.');
        navigate('/login', { replace: true });
        return;
      }
      const profile = await userProfileService.getCurrentProfile().catch(() => null);
      const companion = await createCompanionFromAnswers(user.id, bridgeAnswers, profile);
      if (!companion) throw new Error('Failed to create companion');
      // Next: their signature voice (every one is open), then their look, then the chat.
      navigate('/voice-selection', { replace: true });
    } catch {
      toast.error('There was an error creating your companion. Please try again.');
      setShowBridge(false);
    }
  }, [bridgeAnswers, navigate]);

  if (startOver) return null;

  if (showBridge) {
    return (
      <HonestBridge
        lines={buildCompanionBridgeLines(bridgeAnswers)}
        onComplete={handleBridgeComplete}
        durationMs={3500}
      />
    );
  }

  return (
    <QuestionnaireShell
      host={DEZ}
      reactionCount={buildRemarks}
      definition={WITHOUT_CHOSEN}
      context={ctx}
      initialAnswers={chosen}
      onComplete={handleComplete}
      onAnswer={handleAnswer}
      onBack={() => navigate(-1)}
      showOrb={true}
      renderOrb={renderOrb}
    />
  );
}
