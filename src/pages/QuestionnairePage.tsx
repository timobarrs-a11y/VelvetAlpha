import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuestionData {
  id: string;
  type: 'text' | 'date' | 'choice';
  question: string;
  placeholder?: string;
  options?: Array<{ text: string; score?: { riley?: number; goth?: number } }>;
}

const BASE_QUESTIONS: QuestionData[] = [
  {
    id: 'name',
    type: 'text',
    question: 'First things first... what should I call you? 😊',
    placeholder: 'Enter your name'
  },
  {
    id: 'birthday',
    type: 'date',
    question: 'And when were you born? 🎂'
  },
  {
    id: 'relationshipType',
    type: 'choice',
    question: 'So... who are you hoping to meet? 💕',
    options: [
      { text: 'Girlfriend' },
      { text: 'Boyfriend' }
    ]
  }
];

const GIRLFRIEND_QUESTIONS: QuestionData[] = [
  {
    id: 'energy',
    type: 'choice',
    question: 'Picture your dream girl... is she:',
    options: [
      { text: 'The life Of The Party', score: { riley: 1 } },
      { text: 'Lives In Her Own World', score: { goth: 1 } }
    ]
  },
  {
    id: 'interest',
    type: 'choice',
    question: 'When she likes you, does she:',
    options: [
      { text: 'Flirty & Bold', score: { riley: 1 } },
      { text: 'Reserved & Subtle', score: { goth: 1 } }
    ]
  },
  {
    id: 'vibe',
    type: 'choice',
    question: 'What vibe makes your heart skip a beat?',
    options: [
      { text: 'Bright, energetic, always smiling', score: { riley: 1 } },
      { text: 'Mysterious, deep, keeps you guessing', score: { goth: 1 } }
    ]
  },
  {
    id: 'dynamic',
    type: 'choice',
    question: 'In a relationship, you prefer:',
    options: [
      { text: 'She takes the lead' },
      { text: 'You both share control equally' },
      { text: 'You prefer to lead' }
    ]
  },
  {
    id: 'confrontation',
    type: 'choice',
    question: 'When things get tense, she should:',
    options: [
      { text: 'Lighten the mood with humor' },
      { text: 'Have a calm, rational discussion' },
      { text: 'Focus on understanding feelings' },
      { text: 'Be direct and move forward quickly' }
    ]
  },
  {
    id: 'availability',
    type: 'choice',
    question: 'How much of her time do you want?',
    options: [
      { text: 'Always There When I Need Her' },
      { text: 'Mostly Available But Has Her Own Life' },
      { text: 'Independent - Texts When She Can' }
    ]
  },
  {
    id: 'interests',
    type: 'choice',
    question: "What's she passionate about?",
    options: [
      { text: 'Pop culture, Social Media, Trending Topics' },
      { text: 'Books, philosophy, Deep Discussions' },
      { text: 'Wellness, Self-care, Personal growth' },
      { text: 'Adventure, Travel, New Experiences' }
    ]
  }
];

const BOYFRIEND_QUESTIONS: QuestionData[] = [
  {
    id: 'energy',
    type: 'choice',
    question: 'Picture your dream guy... is he:',
    options: [
      { text: 'The life Of The Party' },
      { text: 'In His Own World' }
    ]
  },
  {
    id: 'interest',
    type: 'choice',
    question: 'When he likes you, does he:',
    options: [
      { text: 'Flirty And Bold' },
      { text: 'Reserved And Subtle' }
    ]
  },
  {
    id: 'vibe',
    type: 'choice',
    question: 'What vibe makes your heart skip a beat?',
    options: [
      { text: 'Bright, energetic, always happy' },
      { text: 'Mysterious, deep, keeps you guessing' }
    ]
  },
  {
    id: 'dynamic',
    type: 'choice',
    question: 'In a relationship, you prefer:',
    options: [
      { text: 'He takes the lead' },
      { text: 'You prefer to lead' }
    ]
  }
];

export function QuestionnairePage() {
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [avatarScore, setAvatarScore] = useState({ riley: 0, goth: 0 });
  const [textInput, setTextInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null);
  const [lastMilestone, setLastMilestone] = useState(0);

  const getQuestions = (): QuestionData[] => {
    if (!answers.relationshipType) {
      return BASE_QUESTIONS;
    }

    if (answers.relationshipType === 'Boyfriend') {
      return [...BASE_QUESTIONS, ...BOYFRIEND_QUESTIONS];
    }

    return [...BASE_QUESTIONS, ...GIRLFRIEND_QUESTIONS];
  };

  const QUESTIONS = getQuestions();
  const question = QUESTIONS[currentQuestion];

  const getTotalQuestions = () => {
    if (!answers.relationshipType) {
      return BASE_QUESTIONS.length + GIRLFRIEND_QUESTIONS.length;
    }
    return QUESTIONS.length;
  };

  const totalQuestions = getTotalQuestions();
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;

  useEffect(() => {
    const currentMilestone = Math.floor(progress / 25) * 25;
    if (currentMilestone > lastMilestone && currentMilestone >= 25 && currentMilestone <= 75) {
      const messages = {
        25: "You're doing great! 🌟",
        50: "Halfway there! 💫",
        75: "Almost done! ✨"
      };
      setMilestoneMessage(messages[currentMilestone as 25 | 50 | 75]);
      setLastMilestone(currentMilestone);
      setTimeout(() => setMilestoneMessage(null), 2000);
    }
  }, [progress, lastMilestone]);

  const getProgressGradient = () => {
    if (progress >= 75) return 'from-pink-600 to-purple-600';
    if (progress >= 50) return 'from-rose-600 to-pink-600';
    if (progress >= 25) return 'from-rose-500 to-pink-500';
    return 'from-rose-400 to-pink-400';
  };

  const getHelperText = () => {
    if (progress >= 80) return 'Almost there... getting exciting! ✨';
    if (progress >= 40) return "You're doing great! Just a few more questions...";
    return 'Take your time - we want to find your perfect match 💕';
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevQuestion = QUESTIONS[currentQuestion - 1];
      setTextInput(answers[prevQuestion.id] || '');
    }
  };

  const handleAnswer = (answer: string, scoreData?: { riley?: number; goth?: number }) => {
    const newAnswers = { ...answers, [question.id]: answer };
    setAnswers(newAnswers);

    if (scoreData) {
      setAvatarScore({
        riley: avatarScore.riley + (scoreData.riley || 0),
        goth: avatarScore.goth + (scoreData.goth || 0)
      });
    }

    let fullQuestions: QuestionData[];
    if (!newAnswers.relationshipType) {
      fullQuestions = BASE_QUESTIONS;
    } else if (newAnswers.relationshipType === 'Boyfriend') {
      fullQuestions = [...BASE_QUESTIONS, ...BOYFRIEND_QUESTIONS];
    } else {
      fullQuestions = [...BASE_QUESTIONS, ...GIRLFRIEND_QUESTIONS];
    }

    if (currentQuestion === fullQuestions.length - 1) {
      let selectedAvatar = 'riley';

      if (newAnswers.relationshipType === 'Girlfriend') {
        if (avatarScore.goth >= 3) {
          selectedAvatar = 'raven';
        } else if (avatarScore.riley >= 3) {
          selectedAvatar = 'riley';
        } else {
          selectedAvatar = Math.random() < 0.5 ? 'riley' : 'raven';
        }
      } else if (newAnswers.relationshipType === 'Boyfriend') {
        selectedAvatar = 'jake';
      }

      const matchData = {
        userName: newAnswers.name,
        userBirthday: newAnswers.birthday,
        relationshipType: newAnswers.relationshipType,
        selectedAvatar,
        dynamicPreference: newAnswers.dynamic,
        confrontationStyle: newAnswers.confrontation,
        availabilityLevel: newAnswers.availability,
        interestPreference: newAnswers.interests
      };

      localStorage.setItem('matchAnswers', JSON.stringify(matchData));
      localStorage.setItem('selectedCharacter', selectedAvatar);
      navigate('/analyzing');
    } else {
      setCurrentQuestion(currentQuestion + 1);
      setTextInput('');
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      handleAnswer(textInput.trim());
    }
  };

  const handleDateSubmit = (date: string) => {
    if (date) {
      handleAnswer(date);
    }
  };

  const handleChoiceClick = (index: number, answer: string, scoreData?: { riley?: number; goth?: number }) => {
    setSelectedOption(index);
    setTimeout(() => {
      handleAnswer(answer, scoreData);
      setSelectedOption(null);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {currentQuestion > 0 && (
          <button
            onClick={handleBack}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back</span>
          </button>
        )}

        <div className="mb-8 relative">
          <AnimatePresence>
            {milestoneMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold text-rose-600 whitespace-nowrap"
              >
                {milestoneMessage}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-gray-600">
              Question {currentQuestion + 1} of {totalQuestions}
            </span>
            <span className="text-sm font-medium text-gray-600">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`bg-gradient-to-r ${getProgressGradient()} h-2.5 rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <motion.h2
                className="text-4xl md:text-5xl font-bold text-gray-800 text-center mb-12 tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {question.question}
              </motion.h2>

          {question.type === 'text' && (
            <div className="space-y-4">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={question.placeholder}
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:border-rose-400 focus:outline-none focus:ring-4 focus:ring-rose-100 focus:scale-[1.01] transition-all duration-200"
                onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                autoFocus
              />
              <button
                onClick={handleTextSubmit}
                disabled={!textInput.trim()}
                className={`w-full py-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:transform-none ${textInput.trim() ? 'animate-pulse-slow' : ''}`}
              >
                Next
              </button>
            </div>
          )}

          {question.type === 'date' && (
            <div className="space-y-4">
              <input
                type="date"
                onChange={(e) => setTextInput(e.target.value)}
                value={textInput}
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:border-rose-400 focus:outline-none focus:ring-4 focus:ring-rose-100 focus:scale-[1.01] transition-all duration-200"
                autoFocus
              />
              <button
                onClick={() => handleDateSubmit(textInput)}
                disabled={!textInput}
                className={`w-full py-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:transform-none ${textInput ? 'animate-pulse-slow' : ''}`}
              >
                Next
              </button>
            </div>
          )}

          {question.type === 'choice' && (
            <div className="space-y-4">
              {question.options?.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleChoiceClick(index, option.text, option.score)}
                  disabled={selectedOption !== null}
                  className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all duration-200 text-lg font-medium hover:scale-[1.02] hover:shadow-lg flex items-center justify-between ${
                    selectedOption === index
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-rose-400 hover:bg-rose-50 text-gray-700 hover:text-rose-600'
                  } ${selectedOption !== null && selectedOption !== index ? 'opacity-50' : ''}`}
                >
                  <span>{option.text}</span>
                  {selectedOption === index && (
                    <Check className="w-6 h-6 text-green-600" />
                  )}
                </button>
              ))}
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            {getHelperText()}
          </p>
        </div>
      </div>
    </div>
  );
}
