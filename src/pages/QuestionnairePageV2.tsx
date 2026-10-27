import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { QuestionnaireDefinition } from '../features/questionnaire';
import { QuestionnaireShell, HonestBridge, PresenceOrb, COMPANION_QUESTIONNAIRE, makeContext } from '../features/questionnaire';
import { supabase } from '../shared/supabase/client';
import { createCompanion } from '../services/companionService';
import { userProfileService } from '../services/userProfileService';
import { toast } from '../shared/ui/Toast';
import { ambientProfileService } from '../services/ambientProfileService';
import { seedVoiceBaseline } from '../services/voiceFidelityService';
import { randomMatchAnswers } from '../utils/companionRandomizer';
import { coherentRandomize } from '../components/AvatarCreatorV2';
import { sanitizeAvatarConfigForSave } from '../services/avatarSaveService';
import { AvatarSaveReveal } from '../components/AvatarSaveReveal';
import { advanceSetupStepIf } from '../services/setupProgressService';
import { takeReturnToHouse, HOUSE_ROUTE } from '../services/velvetHouseReturn';
import type { AvatarConfigV2 } from '../types/avatar-v2';

/** Velvet Rope reached without a gender: ask only who they are looking for. */
const GENDER_ONLY: QuestionnaireDefinition = {
  ...COMPANION_QUESTIONNAIRE,
  chapters: [{ id: 'connection', label: 'How you connect', questionIds: ['relationshipType'] }],
  questions: COMPANION_QUESTIONNAIRE.questions.filter(q => q.id === 'relationshipType'),
};

const HUE_MAP: Record<string, string> = {
  Female: '#ec4899',
  Male: '#3b82f6',
};

function buildCompanionBridgeLines(answers: Record<string, string | string[]>, randomized = false): { text: string }[] {
  const lines: { text: string }[] = [];
  if (randomized) {
    return [
      { text: 'Searching the Velvet Roster...' },
      { text: answers.companionName ? `Found ${answers.companionName}...` : 'Found your match...' },
    ];
  }
  const name = answers.companionName as string;
  const voice = answers.voice as string;
  const gender = answers.relationshipType as string;
  const pronoun = gender === 'Male' ? 'him' : 'her';

  if (voice) {
    const voiceMap: Record<string, string> = {
      direct: `Teaching ${pronoun} to text straight up...`,
      playful: `Teaching ${pronoun} to keep you on your toes...`,
      gentle: `Teaching ${pronoun} to be gentle with you...`,
      mysterious: `Teaching ${pronoun} to keep you guessing...`,
    };
    lines.push({ text: voiceMap[voice] || `Teaching ${pronoun} to text the way you liked...` });
  }

  if (name) {
    lines.push({ text: `Setting up ${name}...` });
  } else {
    lines.push({ text: `Setting ${pronoun} up...` });
  }

  return lines;
}

export function QuestionnairePageV2() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // "From inside the Velvet Rope": the person picked who they want (gender) and what kind of connection on the
  // screen before, and everything else (personality, name, voice and, on the next page, the look) is random.
  const velvetGenderParam = searchParams.get('gender');
  const velvetMode = searchParams.get('mode') === 'velvet';
  const velvetGender: 'male' | 'female' | null = velvetMode && (velvetGenderParam === 'Male' || velvetGenderParam === 'Female')
    ? (velvetGenderParam === 'Male' ? 'male' : 'female') : null;
  const velvetConnection: 'friend' | 'romantic' =
    (searchParams.get('type') ?? (sessionStorage.getItem('onboardingRelationshipType') === 'friend' ? 'friend' : 'romantic')) === 'friend' ? 'friend' : 'romantic';
  const velvetFired = useRef(false);
  // Where a finished random match lands, and who to show, once its look is saved.
  const [reveal, setReveal] = useState<{ config: AvatarConfigV2; name: string; to: string } | null>(null);
  const [showBridge, setShowBridge] = useState(false);
  const [bridgeAnswers, setBridgeAnswers] = useState<Record<string, string | string[]>>({});
  const [liveAnswers, setLiveAnswers] = useState<Record<string, string | string[]>>({});
  const [profileName, setProfileName] = useState<string | undefined>(undefined);

  useEffect(() => {
    userProfileService.getCurrentProfile()
      .then(p => { if (p?.name) setProfileName(p.name); })
      .catch(() => {});
  }, []);

  // Gender known: no questions at all, straight to the match.
  useEffect(() => {
    if (!velvetGender || velvetFired.current) return;
    velvetFired.current = true;
    setBridgeAnswers(randomMatchAnswers(velvetGender, velvetConnection));
    setShowBridge(true);
  }, [velvetGender, velvetConnection]);

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
    const chips: string[] = [];
    const voice = liveAnswers.voice as string;
    const warmth = liveAnswers.warmth as string;

    if (voice) chips.push(voice);
    if (warmth) chips.push(warmth);
    return chips;
  }, [liveAnswers]);

  const orbLabel = (liveAnswers.companionName as string) || undefined;

  const renderOrb = useCallback(
    () => <PresenceOrb hue={hue} energy={energy} traitChips={traitChips} label={orbLabel} size={100} />,
    [hue, energy, traitChips, orbLabel]
  );

  const handleComplete = useCallback(async (answers: Record<string, string | string[]>) => {
    // Velvet Rope without a gender in the link: they only answered who, the rest is random.
    if (velvetMode) {
      const g: 'male' | 'female' = answers.relationshipType === 'Male' ? 'male' : 'female';
      setBridgeAnswers(randomMatchAnswers(g, velvetConnection));
    } else {
      setBridgeAnswers(answers);
    }
    setShowBridge(true);
  }, [velvetMode, velvetConnection]);

  const handleAnswer = useCallback((_questionId: string, _answer: string | string[], allAnswers: Record<string, string | string[]>) => {
    setLiveAnswers(allAnswers);
  }, []);

  const handleBridgeComplete = useCallback(async () => {
    const answers = bridgeAnswers;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Your session expired. Please sign in again.');
        navigate('/login', { replace: true });
        return;
      }

      let existingProfile: any = null;
      try {
        existingProfile = await userProfileService.getCurrentProfile();
      } catch {}

      const a = answers as Record<string, string>;
      const companionGender: 'male' | 'female' = a.relationshipType === 'Male' ? 'male' : 'female';
      const connection = a.connectionType?.includes('friend') ? 'friend' : 'romantic';
      const customName = a.companionName || '';

      const matchData = {
        userName: existingProfile?.name || '',
        userBirthday: existingProfile?.birthday || '',
        userGender: existingProfile?.gender || '',
        relationshipType: a.relationshipType as 'Male' | 'Female',
        connectionType: connection as 'friend' | 'romantic',
        energyPreference: a.energy,
        flirtingStyle: a.warmth,
        humorStyle: a.warmth,
        communicationStyle: a.voice,
        emotionalOpenness: 'Opens Up Over Time',
        conversationDepth: 'Perfect Mix Of Both',
        expressiveness: 'Balanced Expression',
        initiative: 'You Both Share',
        interestPreference: Array.isArray(a.interests) ? a.interests[0] : a.interests,
        loveLanguage: a.loveLanguage,
        supportStyle: 'Just Listens & Validates Feelings',
        lifeContext: existingProfile?.lifeContext || 'Doing Well',
        confrontationStyle: a.whenItsHard,
        availabilityLevel: 'Mostly Available',
        dynamicPreference: 'You Both Share Control Equally',
        companionName: customName,
        favoriteColor: existingProfile?.favorite_color || '',
        hobbies: Array.isArray(a.interests) ? a.interests.join(', ') : '',
        sports: Array.isArray(a.tasteDeck) ? a.tasteDeck.join(', ') : '',
        musicGenre: existingProfile?.music_genre || '',
        newsTopics: existingProfile?.news_categories || [],
      };

      sessionStorage.setItem('matchAnswers', JSON.stringify(matchData));

      const companion = await createCompanion({
        userId: user.id,
        gender: companionGender,
        relationshipType: connection as 'friend' | 'romantic',
        customName,
        hobbies: Array.isArray(a.interests) ? a.interests : [],
        sports: Array.isArray(a.tasteDeck) ? a.tasteDeck : [],
        dynamicPreference: matchData.dynamicPreference,
        confrontationStyle: matchData.confrontationStyle,
        availabilityLevel: matchData.availabilityLevel,
        interestPreference: matchData.interestPreference,
        interestText: matchData.interestPreference,
        loveLanguage: matchData.loveLanguage,
        supportStyle: matchData.supportStyle,
        lifeContext: matchData.lifeContext,
        energyPreference: matchData.energyPreference,
        flirtingStyle: matchData.flirtingStyle,
        humorStyle: matchData.humorStyle,
        communicationStyle: matchData.communicationStyle,
        emotionalOpenness: matchData.emotionalOpenness,
        conversationDepth: matchData.conversationDepth,
        expressiveness: matchData.expressiveness,
        initiative: matchData.initiative,
        favoriteColor: matchData.favoriteColor,
        musicGenre: matchData.musicGenre,
        newsCategories: matchData.newsTopics,
        signatureVoice: typeof a.signatureVoice === 'string' ? a.signatureVoice : undefined,
        signatureExpert: sessionStorage.getItem('selectedExpertId') || undefined,
        signatureExpertSource: (sessionStorage.getItem('selectedExpertSource') as 'curated' | 'user') || undefined,
        questionnaireData: matchData,
      });

      if (companion && companion.id) {
        sessionStorage.setItem('currentCompanionId', companion.id);
        // A random match gets a random look on the next page, locked to its gender; a draft look left from an
        // earlier companion is dropped so it can't turn up on this one.
        sessionStorage.setItem('companionRandomized', velvetMode ? '1' : '');
        try { localStorage.removeItem('companion-avatar-draft'); } catch { /* storage blocked */ }
        if (typeof a.signatureVoice === 'string') seedVoiceBaseline(companion.id, a.signatureVoice, companionGender).catch(() => {});
        ambientProfileService.seedFromQuestionnaire(user.id, answers).catch(() => {});

        if (velvetGender) {
          // They asked for it all at random, so it ends here: the look is chosen too (the gender they picked), a short
          // "meet them", then straight to the chat (or back to the house). No face to design, no chat styling, no
          // "who do you want to talk to".
          try {
            const look = await sanitizeAvatarConfigForSave(coherentRandomize(velvetGender));
            const { error: lookError } = await supabase.from('companions').update({ avatar_config: look }).eq('id', companion.id);
            if (lookError) throw lookError;
            await advanceSetupStepIf(user.id, ['companion_in_progress', 'choose_conversation'], 'complete');
            const to = takeReturnToHouse() ? HOUSE_ROUTE : `/chat?companion=${companion.id}`;
            sessionStorage.removeItem('currentCompanionId');
            sessionStorage.removeItem('matchAnswers');
            sessionStorage.removeItem('companionRandomized');
            setShowBridge(false);
            setReveal({ config: look, name: customName, to });
            return;
          } catch (lookError) {
            // The companion exists; only the look failed. Let them make it by hand rather than start over.
            console.error('[companion] random look not saved:', lookError);
          }
        }
        navigate('/create-companion-avatar', { replace: true });
      } else {
        throw new Error('Failed to create companion');
      }
    } catch {
      toast.error('There was an error creating your companion. Please try again.');
      if (velvetGender) {
        // Nothing to go back to here: start the random pick again from the choice screen.
        navigate('/companion-path', { replace: true });
        return;
      }
      setShowBridge(false);
    }
  }, [bridgeAnswers, navigate, velvetMode, velvetGender]);

  if (reveal) {
    return (
      <AvatarSaveReveal
        config={reveal.config}
        companionName={reveal.name}
        isCompanion={true}
        onContinue={() => navigate(reveal.to, { replace: true })}
        autoDismissMs={2500}
      />
    );
  }

  if (showBridge) {
    return (
      <HonestBridge
        lines={buildCompanionBridgeLines(bridgeAnswers, velvetMode)}
        onComplete={handleBridgeComplete}
        durationMs={3500}
      />
    );
  }

  // Between landing here and the match starting there is nothing to ask.
  if (velvetGender) return null;

  return (
    <QuestionnaireShell
      definition={velvetMode ? GENDER_ONLY : COMPANION_QUESTIONNAIRE}
      context={ctx}
      onComplete={handleComplete}
      onAnswer={handleAnswer}
      onBack={() => navigate(-1)}
      showOrb={true}
      renderOrb={renderOrb}
    />
  );
}
