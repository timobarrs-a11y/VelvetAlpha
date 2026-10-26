import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuestionnaireShell, HonestBridge, PERSONAL_QUESTIONNAIRE, makeContext, resolveZodiac } from '../features/questionnaire';
import { answersFromProfile, profileUpdateFor, resumeIndex } from '../features/questionnaire/arrivalAnswers';
import { somedayFromAnswers } from '../features/questionnaire/personalBank';
import { userProfileService } from '../services/userProfileService';
import { toast } from '../shared/ui/Toast';
import { supabase } from '../shared/supabase/client';
import { AuthSpinner } from '../components/auth/AuthSpinner';
import { ARRIVAL_ROUTES } from '../features/arrival/arrivalRoutes';

/** Where Act 1 leads: making their avatar, the next step of the arrival. */
const AFTER_QUESTIONNAIRE_ROUTE = ARRIVAL_ROUTES.look;

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
    lines.push({ text: `Now for the fun part, ${name}...` });
  }
  if (lines.length === 0) {
    lines.push({ text: 'Getting everything ready...' });
  }
  return lines;
}

const asList = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v] : []);

export function UserProfileQuestionnairePageV2() {
  const navigate = useNavigate();
  const [showBridge, setShowBridge] = useState(false);
  const [bridgeAnswers, setBridgeAnswers] = useState<Record<string, string | string[]>>({});
  const [resume, setResume] = useState<{ answers: Record<string, string | string[]>; index: number } | null>(null);

  const ctx = useMemo(() => makeContext({}, '', 'user'), []);

  // Pick up where they left off; anyone who's finished goes straight on.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await userProfileService.getCurrentProfile().catch(() => null);
      if (cancelled) return;
      if (profile?.profile_completed) {
        navigate(AFTER_QUESTIONNAIRE_ROUTE, { replace: true });
        return;
      }
      const answers = answersFromProfile(profile);
      setResume({ answers, index: resumeIndex(PERSONAL_QUESTIONNAIRE, answers, ctx) });
    })();
    return () => { cancelled = true; };
  }, [ctx, navigate]);

  // Each answer is saved as it's given, so nothing is lost if they leave.
  const handleAnswer = useCallback((questionId: string, answer: string | string[], all: Record<string, string | string[]>) => {
    const update = profileUpdateFor(questionId, answer, all);
    if (!update) return;
    userProfileService.updateProfile(update).catch(err => console.error('[questionnaire] save failed:', questionId, err));
  }, []);

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
        hobbies: asList(finalAnswers.hobbies).join(','),
        sports: asList(finalAnswers.sportsInterests).join(','),
        musicGenre: asList(finalAnswers.musicGenre).join(', '),
        newsTopics: [],
        entertainmentInterests: asList(finalAnswers.entertainmentInterests),
        techInterests: asList(finalAnswers.techInterests),
        lifestyleInterests: asList(finalAnswers.lifestyleInterests),
        sportsInterests: asList(finalAnswers.sportsInterests),
      });
      await userProfileService.updateProfile({ someday: somedayFromAnswers(finalAnswers) });
    } catch {
      toast.error('Something went wrong saving your profile. Please try again.');
      return;
    }

    supabase.rpc('join_spaces_from_interests').then(() => {}, () => {});

    setBridgeAnswers(finalAnswers);
    setShowBridge(true);
  }, []);

  const handleBridgeComplete = useCallback(() => {
    navigate(AFTER_QUESTIONNAIRE_ROUTE, { replace: true });
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

  if (!resume) return <AuthSpinner />;

  return (
    <QuestionnaireShell
      definition={PERSONAL_QUESTIONNAIRE}
      context={ctx}
      initialAnswers={resume.answers}
      initialIndex={resume.index}
      onAnswer={handleAnswer}
      onComplete={handleComplete}
      onBack={() => navigate(-1)}
    />
  );
}
