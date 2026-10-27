import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuestionnaireShell, HonestBridge, PERSONAL_QUESTIONNAIRE, makeContext, resolveZodiac } from '../features/questionnaire';
import { answersFromProfile, profileUpdateFor, resumeIndex } from '../features/questionnaire/arrivalAnswers';
import { somedayFromAnswers } from '../features/questionnaire/personalBank';
import { userProfileService } from '../services/userProfileService';
import { toast } from '../shared/ui/Toast';
import { supabase } from '../shared/supabase/client';
import { ARRIVAL_STEPS, getSetupProgress, prepareResume, updateSetupProgress } from '../services/setupProgressService';
import { AuthSpinner } from '../components/auth/AuthSpinner';
import { ARRIVAL_ROUTES } from '../features/arrival/arrivalRoutes';
import { DEZ } from '../features/questionnaire/dez';
import { WelcomeMoment } from '../features/questionnaire/WelcomeMoment';
import { rememberWelcomeSeen, shouldShowWelcome } from '../features/questionnaire/welcome';

/** Where Act 1 leads: making their avatar, the next step of the arrival. */
// Straight on to the goal with Atlas; the avatar and house come while his plan is being drafted.
const AFTER_QUESTIONNAIRE_ROUTE = ARRIVAL_ROUTES.atlas;

function buildBridgeLines(answers: Record<string, string | string[]>): { text: string }[] {
  const lines: { text: string }[] = [];
  // Private to them, but still their nickname first.
  const name = ((answers.nickname as string) || (answers.name as string)) ?? '';
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
  // Members from before age checks go through the questions again to confirm a birthday; they are not
  // new, so they skip the arrival and land in the lobby afterwards.
  const [verifyOnly, setVerifyOnly] = useState(false);
  const [resume, setResume] = useState<{ answers: Record<string, string | string[]>; index: number } | null>(null);
  // A short branded welcome, once, before the very first question.
  const [welcome, setWelcome] = useState<{ userId?: string } | null>(null);

  const ctx = useMemo(() => makeContext({}, '', 'user'), []);

  // Pick up where they left off; anyone who's finished goes straight on.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await userProfileService.getCurrentProfile().catch(() => null);
      if (cancelled) return;
      const needsAgeCheck = !!profile?.profile_completed && !profile.age_verified_at;
      if (profile?.profile_completed && !needsAgeCheck) {
        // Wherever they got to in the arrival; anyone who finished it all goes to the lobby.
        const progress = profile.id ? await getSetupProgress(profile.id) : null;
        const next = progress?.step && ARRIVAL_STEPS.includes(progress.step) ? prepareResume(progress, []) : null;
        navigate(next ?? '/lobby', { replace: true });
        return;
      }
      const answers = answersFromProfile(profile);
      // An age check starts from the top, with everything they already said filled in.
      const index = needsAgeCheck ? 0 : resumeIndex(PERSONAL_QUESTIONNAIRE, answers, ctx);
      setVerifyOnly(needsAgeCheck);
      setResume({ answers, index });
      if (shouldShowWelcome(profile, index)) setWelcome({ userId: profile?.id });
    })();
    return () => { cancelled = true; };
  }, [ctx, navigate]);

  // Each answer is saved as it's given, so nothing is lost if they leave.
  const handleAnswer = useCallback((questionId: string, answer: string | string[], all: Record<string, string | string[]>) => {
    if (questionId === 'birthday') {
      // The server checks the age and marks the account verified; the app can't write either itself.
      supabase.rpc('confirm_birthday', { p_birthday: String(answer) }).then(({ data, error }) => {
        const result = data as { success?: boolean; reason?: string } | null;
        if (error || !result?.success) {
          console.error('[questionnaire] birthday not saved:', error ?? result);
          toast.error(result?.reason === 'underage' ? 'Velvet is for people 18 and over.' : "We couldn't save your birthday. Check it and try again.");
        }
      }, err => console.error('[questionnaire] birthday not saved:', err));
      return;
    }
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
      // From here the first session is under way, so the app sends them back to it until it's done.
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !verifyOnly) await updateSetupProgress(user.id, { step: 'arrival_goal' });
    } catch {
      toast.error('Something went wrong saving your profile. Please try again.');
      return;
    }

    supabase.rpc('join_spaces_from_interests').then(() => {}, () => {});

    setBridgeAnswers(finalAnswers);
    setShowBridge(true);
  }, [verifyOnly]);

  const handleBridgeComplete = useCallback(() => {
    navigate(verifyOnly ? '/lobby' : AFTER_QUESTIONNAIRE_ROUTE, { replace: true });
  }, [navigate, verifyOnly]);

  if (showBridge) {
    return (
      <HonestBridge
        lines={buildBridgeLines(bridgeAnswers)}
        onComplete={handleBridgeComplete}
        durationMs={3500}
      />
    );
  }

  const closeWelcome = () => {
    rememberWelcomeSeen(welcome?.userId);
    userProfileService.updateProfile({ welcome_seen: true }).catch(() => {});
    setWelcome(null);
  };

  if (!resume) return <AuthSpinner />;

  return (
    <>
    {welcome && <WelcomeMoment onDone={closeWelcome} />}
    <QuestionnaireShell
      definition={PERSONAL_QUESTIONNAIRE}
      context={ctx}
      initialAnswers={resume.answers}
      initialIndex={resume.index}
      onAnswer={handleAnswer}
      onComplete={handleComplete}
      onBack={() => navigate(-1)}
      host={DEZ}
    />
    </>
  );
}
