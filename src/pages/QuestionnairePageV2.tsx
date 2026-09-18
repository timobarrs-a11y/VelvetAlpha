import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuestionnaireShell, HonestBridge, PresenceOrb, COMPANION_QUESTIONNAIRE, makeContext, tpl } from '../features/questionnaire';
import { supabase } from '../shared/supabase/client';
import { createCompanion } from '../services/companionService';
import { userProfileService } from '../services/userProfileService';
import { toast } from '../shared/ui/Toast';
import { ambientProfileService } from '../services/ambientProfileService';

const HUE_MAP: Record<string, string> = {
  Female: '#ec4899',
  Male: '#3b82f6',
};

function buildCompanionBridgeLines(answers: Record<string, string | string[]>): { text: string }[] {
  const lines: { text: string }[] = [];
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
  const [showBridge, setShowBridge] = useState(false);
  const [bridgeAnswers, setBridgeAnswers] = useState<Record<string, string | string[]>>({});
  const [liveAnswers, setLiveAnswers] = useState<Record<string, string | string[]>>({});

  const gender = (liveAnswers.relationshipType as string) || '';
  const connectionType = (liveAnswers.connectionType as string) || '';
  const userName = (liveAnswers.userName as string) || undefined;

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
    const name = liveAnswers.companionName as string;

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
    setBridgeAnswers(answers);
    setShowBridge(true);
  }, []);

  const handleAnswer = useCallback((questionId: string, _answer: string | string[], allAnswers: Record<string, string | string[]>) => {
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
        relationshipType: a.relationshipType,
        connectionType: connection,
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
        signatureExpert: sessionStorage.getItem('selectedExpertId') || undefined,
        signatureExpertSource: (sessionStorage.getItem('selectedExpertSource') as 'curated' | 'user') || undefined,
        questionnaireData: matchData,
      });

      if (companion && companion.id) {
        sessionStorage.setItem('currentCompanionId', companion.id);
        ambientProfileService.seedFromQuestionnaire(user.id, answers).catch(() => {});
        navigate('/create-companion-avatar', { replace: true });
      } else {
        throw new Error('Failed to create companion');
      }
    } catch {
      toast.error('There was an error creating your companion. Please try again.');
      setShowBridge(false);
    }
  }, [bridgeAnswers, navigate]);

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
      definition={COMPANION_QUESTIONNAIRE}
      context={ctx}
      onComplete={handleComplete}
      onAnswer={handleAnswer}
      showOrb={true}
      renderOrb={renderOrb}
    />
  );
}
