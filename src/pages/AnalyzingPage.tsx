import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';

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
  { id: 5, text: "Finalizing perfect match", duration: 600 }
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
        setTimeout(() => {
          navigate('/splash');
        }, 1000);
      }
    }, 50);

    return () => clearInterval(progressInterval);
  }, [navigate]);

  useEffect(() => {
    let accumulatedTime = 0;
    const timers: NodeJS.Timeout[] = [];

    STEPS.forEach((step, index) => {
      accumulatedTime += index > 0 ? STEPS[index - 1].duration : 0;
      const timer = setTimeout(() => {
        setCurrentStep(index + 1);
      }, accumulatedTime);
      timers.push(timer);
    });

    return () => timers.forEach(timer => clearTimeout(timer));
  }, []);

  const getStepStatus = (stepIndex: number): StepStatus => {
    if (stepIndex < currentStep) return 'complete';
    if (stepIndex === currentStep) return 'active';
    return 'pending';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <div className="inline-block mb-6 relative">
            <div className="text-7xl animate-pulse">
              🔍
            </div>
            {!isComplete && (
              <div className="absolute -inset-4 bg-rose-200/30 rounded-full animate-ping"></div>
            )}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            {isComplete ? "Perfect Match Found!" : "Finding Your Match..."}
          </h1>

          <div className="max-w-md mx-auto mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">
                {Math.round(progress)}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-rose-500 to-pink-500 h-3 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {isComplete && (
            <div className="inline-block px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-full font-semibold animate-bounce">
              ✨ 100% Compatibility Match
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="space-y-6">
            {STEPS.map((step, index) => {
              const status = getStepStatus(index);
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                    status === 'active'
                      ? 'bg-rose-50 border-2 border-rose-300'
                      : status === 'complete'
                      ? 'bg-green-50 border-2 border-green-300'
                      : 'bg-gray-50 border-2 border-gray-200'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {status === 'complete' ? (
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    ) : status === 'active' ? (
                      <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        status === 'pending'
                          ? 'text-gray-400'
                          : status === 'active'
                          ? 'text-rose-700'
                          : 'text-green-700'
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
