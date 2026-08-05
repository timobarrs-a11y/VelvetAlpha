import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { createCompanion } from '../services/companionService';

interface Step {
  id: number;
  text: string;
  duration: number;
}

const STEPS: Step[] = [
  { id: 1, text: "Processing personality profile", duration: 600 },
  { id: 2, text: "Analyzing communication preferences", duration: 600 },
  { id: 3, text: "Matching interest compatibility", duration: 600 },
  { id: 4, text: "Evaluating lifestyle alignment", duration: 600 },
  { id: 5, text: "Creating your perfect match", duration: 600 }
];

type StepStatus = 'pending' | 'active' | 'complete';

export function AnalyzingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const totalDuration = STEPS.reduce((sum, step) => sum + step.duration, 0);
    let elapsed = 0;

    const progressInterval = setInterval(() => {
      elapsed += 50;
      const newProgress = Math.min((elapsed / totalDuration) * 100, 100);
      setProgress(newProgress);

      if (elapsed >= totalDuration) {
        clearInterval(progressInterval);
        setIsComplete(true);
        setTimeout(async () => {
          await createCompanionFromAnswers();
        }, 1000);
      }
    }, 50);

    return () => clearInterval(progressInterval);
  }, [navigate]);

  useEffect(() => {
    let accumulatedTime = 0;
    const timers: NodeJS.Timeout[] = [];

    STEPS.forEach((_step, index) => {
      accumulatedTime += index > 0 ? STEPS[index - 1].duration : 0;
      const timer = setTimeout(() => {
        setCurrentStep(index + 1);
      }, accumulatedTime);
      timers.push(timer);
    });

    return () => timers.forEach(timer => clearTimeout(timer));
  }, []);

  const createCompanionFromAnswers = async () => {
    try {
      const matchData = JSON.parse(sessionStorage.getItem('matchAnswers') || '{}');
      let { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const randomEmail = `user_${Date.now()}@aicompanion.app`;
        const randomPassword = `pwd_${Math.random().toString(36).slice(2)}${Date.now()}`;

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: randomEmail,
          password: randomPassword,
          options: {
            data: {
              character_type: matchData.relationshipType,
              user_name: matchData.userName,
            },
          },
        });

        if (signUpError || !authData.user) {
          console.error('Error signing up:', signUpError);
          navigate('/questionnaire');
          return;
        }

        user = authData.user;

        await supabase
          .from('user_profiles')
          .update({ name: matchData.userName })
          .eq('id', user.id);
      }

      if (!matchData.relationshipType) {
        console.error('No companion type selected');
        navigate('/questionnaire');
        return;
      }

      await supabase
        .from('user_profiles')
        .update({
          name: matchData.userName,
          birthday: matchData.userBirthday || null,
          gender: matchData.userGender || null
        })
        .eq('id', user.id);

      const gender: 'male' | 'female' = matchData.relationshipType === 'Male' ? 'male' : 'female';
      const relationshipType = (matchData.connectionType || 'romantic') as 'friend' | 'romantic';
      const customName = matchData.companionName || '';
      const hobbies = matchData.hobbies ? matchData.hobbies.split(',').map((h: string) => h.trim()).filter((h: string) => h) : [];
      const sports = matchData.sports ? matchData.sports.split(',').map((s: string) => s.trim()).filter((s: string) => s) : [];

      const companion = await createCompanion({
        userId: user.id,
        gender,
        relationshipType,
        customName,
        hobbies,
        sports,
        dynamicPreference: matchData.dynamicPreference,
        confrontationStyle: matchData.confrontationStyle,
        availabilityLevel: matchData.availabilityLevel,
        interestPreference: matchData.interestPreference,
        questionnaireData: {
          userName: matchData.userName,
          userBirthday: matchData.userBirthday,
          userGender: matchData.userGender,
          relationshipType: matchData.relationshipType,
          connectionType: relationshipType,
          hobbies: matchData.hobbies || '',
          sports: matchData.sports || '',
          dynamicPreference: matchData.dynamicPreference,
          confrontationStyle: matchData.confrontationStyle,
          availabilityLevel: matchData.availabilityLevel,
          interestPreference: matchData.interestPreference,
          companionName: customName
        }
      });

      if (companion) {
        sessionStorage.setItem('currentCompanionId', companion.id);
        navigate('/voice-selection');
      } else {
        console.error('Failed to create companion');
        navigate('/questionnaire');
      }
    } catch (error) {
      console.error('Error creating companion:', error);
      navigate('/questionnaire');
    }
  };

  const getStepStatus = (stepIndex: number): StepStatus => {
    if (stepIndex < currentStep) return 'complete';
    if (stepIndex === currentStep) return 'active';
    return 'pending';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-rose-900 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <div className="inline-block mb-6 relative">
            <div className="text-7xl animate-pulse">
              🔍
            </div>
            {!isComplete && (
              <div className="absolute -inset-4 bg-purple-500/30 rounded-full animate-ping"></div>
            )}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {isComplete ? "Perfect Match Found!" : "Finding Your Match..."}
          </h1>

          <div className="max-w-md mx-auto mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-300">
                {Math.round(progress)}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-rose-500 h-3 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {isComplete && (
            <div className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-rose-500 text-white rounded-full font-semibold animate-bounce">
              ✨ 100% Compatibility Match
            </div>
          )}
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl shadow-xl p-8">
          <div className="space-y-6">
            {STEPS.map((step, index) => {
              const status = getStepStatus(index);
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                    status === 'active'
                      ? 'bg-purple-900/30 border-2 border-purple-400'
                      : status === 'complete'
                      ? 'bg-green-900/30 border-2 border-green-500'
                      : 'bg-gray-700/30 border-2 border-gray-600'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {status === 'complete' ? (
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    ) : status === 'active' ? (
                      <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-600"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        status === 'pending'
                          ? 'text-gray-400'
                          : status === 'active'
                          ? 'text-purple-200'
                          : 'text-green-300'
                      }`}
                    >
                      {step.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
