import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuestionnaireShell, HonestBridge, PERSONAL_QUESTIONNAIRE, makeContext, resolveZodiac } from '../features/questionnaire';
import { userProfileService } from '../services/userProfileService';
import { toast } from '../shared/ui/Toast';
import { AtlasTransitionOverlay } from '../components/AtlasTransitionOverlay';

function buildBridgeLines(answers: Record<string, string | string[]>): { text: string }[] {
  const lines: { text: string }[] = [];
  const name = answers.name as string;
  const music = answers.musicGenre;
  const hobbies = answers.hobbies as string[];

  if (music) {
    const musicStr = Array.isArray(music) ? music[0] : music;
    lines.push({ text: `Tuning your feed to ${musicStr}...` });
  }
  if (hobbies && hobbies.length > 0) {
    lines.push({ text: `Remembering you're into ${hobbies.slice(0, 2).join(' and ')}...` });
  }
  if (name) {
    lines.push({ text: `Setting everything up for you, ${name}...` });
  }
  if (lines.length === 0) {
    lines.push({ text: 'Getting everything ready...' });
  }
  return lines;
}

export function UserProfileQuestionnairePageV2() {
  const navigate = useNavigate();
  const [showBridge, setShowBridge] = useState(false);
  const [bridgeAnswers, setBridgeAnswers] = useState<Record<string, string | string[]>>({});

  const ctx = makeContext({}, '', 'user');

  const handleComplete = useCallback(async (answers: Record<string, string | string[]>) => {
    const zodiac = resolveZodiac(answers);
    const finalAnswers = zodiac ? { ...answers, zodiacSign: zodiac } : answers;

    try {
      await userProfileService.saveUserLevelAnswers({
        name: String(finalAnswers.name || ''),
        nickname: String(finalAnswers.nickname || '').trim() || undefined,
        birthday: String(finalAnswers.birthday || ''),
        gender: String(finalAnswers.gender || ''),
        favoriteColor: String(finalAnswers.favoriteColor || ''),
        zodiacSign: zodiac || '',
        hobbies: Array.isArray(finalAnswers.hobbies) ? finalAnswers.hobbies.join(',') : String(finalAnswers.hobbies || ''),
        sports: Array.isArray(finalAnswers.tasteDeck) ? finalAnswers.tasteDeck.join(',') : '',
        musicGenre: Array.isArray(finalAnswers.musicGenre) ? finalAnswers.musicGenre.join(', ') : String(finalAnswers.musicGenre || ''),
        newsTopics: [],
      });

      const commProfile = {
        conflict: String(finalAnswers.conflictResponse || ''),
        connection: String(finalAnswers.connection || ''),
        decisionStyle: String(finalAnswers.decisionStyle || ''),
        motivation: String(finalAnswers.motivation || ''),
      };
      if (commProfile.conflict && commProfile.connection && commProfile.decisionStyle && commProfile.motivation) {
        await userProfileService.saveCommunicationProfile(commProfile);
      }
    } catch {
      toast.error('Something went wrong saving your profile. Please try again.');
      return;
    }

    setBridgeAnswers(finalAnswers);
    setShowBridge(true);
  }, []);

  const handleBridgeComplete = useCallback(() => {
    setShowBridge(false);
    navigate('/atlas-onboarding');
  }, [navigate]);

  if (showBridge) {
    return (
      <HonestBridge
        lines={buildBridgeLines(bridgeAnswers)}
        onComplete={handleBridgeComplete}
        durationMs={3500}
      />
    );
  }

  return (
    <QuestionnaireShell
      definition={PERSONAL_QUESTIONNAIRE}
      context={ctx}
      onComplete={handleComplete}
    />
  );
}
