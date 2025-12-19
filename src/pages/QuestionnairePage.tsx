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
    question: 'First Things First... What Should I Call You? 😊',
    placeholder: 'Enter your name'
  },
  {
    id: 'birthday',
    type: 'date',
    question: 'And When Were You Born? 🎂'
  },
  {
    id: 'relationshipType',
    type: 'choice',
    question: 'Which Companion Are You Interested In?',
    options: [
      { text: 'Female' },
      { text: 'Male' }
    ]
  },
  {
    id: 'connectionType',
    type: 'choice',
    question: 'What Kind Of Connection Are You Looking For?',
    options: [
      { text: 'Just a friend to talk to 🤝' },
      { text: 'Something more... 💕' }
    ]
  }
];

const GIRLFRIEND_QUESTIONS: QuestionData[] = [
  {
    id: 'energy',
    type: 'choice',
    question: 'Picture Your Dream Girl... Is She:',
    options: [
      { text: 'The Life Of The Party', score: { riley: 1 } },
      { text: 'Lives In Her Own World', score: { goth: 1 } }
    ]
  },
  {
    id: 'interest',
    type: 'choice',
    question: 'When She Likes You, Does She:',
    options: [
      { text: 'Flirty & Bold', score: { riley: 1 } },
      { text: 'Reserved & Subtle', score: { goth: 1 } }
    ]
  },
  {
    id: 'vibe',
    type: 'choice',
    question: 'What Vibe Makes Your Heart Skip A Beat?',
    options: [
      { text: 'Bright, Energetic, Always Smiling', score: { riley: 1 } },
      { text: 'Mysterious, Deep, Keeps You Guessing', score: { goth: 1 } }
    ]
  },
  {
    id: 'dynamic',
    type: 'choice',
    question: 'In A Relationship, You Prefer:',
    options: [
      { text: 'She Takes The Lead' },
      { text: 'You Both Share Control Equally' },
      { text: 'You Prefer To Lead' }
    ]
  },
  {
    id: 'confrontation',
    type: 'choice',
    question: 'When Things Get Tense, She Should:',
    options: [
      { text: 'Lighten The Mood With Humor' },
      { text: 'Have A Calm, Rational Discussion' },
      { text: 'Focus On Understanding Feelings' },
      { text: 'Be Direct And Move Forward Quickly' }
    ]
  },
  {
    id: 'availability',
    type: 'choice',
    question: 'How Much Of Her Time Do You Want?',
    options: [
      { text: 'Always There When I Need Her' },
      { text: 'Mostly Available But Has Her Own Life' },
      { text: 'Independent - Texts When She Can' }
    ]
  },
  {
    id: 'interests',
    type: 'choice',
    question: "What's She Passionate About?",
    options: [
      { text: 'Pop Culture, Social Media, Trending Topics' },
      { text: 'Books, Philosophy, Deep Discussions' },
      { text: 'Wellness, Self-Care, Personal Growth' },
      { text: 'Adventure, Travel, New Experiences' }
    ]
  }
];

const BOYFRIEND_QUESTIONS: QuestionData[] = [
  {
    id: 'energy',
    type: 'choice',
    question: 'Picture Your Dream Guy... Is He:',
    options: [
      { text: 'The Life Of The Party' },
      { text: 'In His Own World' }
    ]
  },
  {
    id: 'interest',
    type: 'choice',
    question: 'When He Likes You, Does He:',
    options: [
      { text: 'Flirty And Bold' },
      { text: 'Reserved And Subtle' }
    ]
  },
  {
    id: 'vibe',
    type: 'choice',
    question: 'What Vibe Makes Your Heart Skip A Beat?',
    options: [
      { text: 'Bright, Energetic, Always Happy' },
      { text: 'Mysterious, Deep, Keeps You Guessing' }
    ]
  },
  {
    id: 'dynamic',
    type: 'choice',
    question: 'In A Relationship, You Prefer:',
    options: [
      { text: 'He Takes The Lead' },
      { text: 'You Prefer To Lead' }
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

    if (answers.relationshipType === 'Male') {
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
    } else if (newAnswers.relationshipType === 'Male') {
      fullQuestions = [...BASE_QUESTIONS, ...BOYFRIEND_QUESTIONS];
    } else {
      fullQuestions = [...BASE_QUESTIONS, ...GIRLFRIEND_QUESTIONS];
    }

    if (currentQuestion === fullQuestions.length - 1) {
      let selectedAvatar = 'riley';

      if (newAnswers.relationshipType === 'Female') {
        if (avatarScore.goth >= 3) {
          selectedAvatar = 'raven';
        } else if (avatarScore.riley >= 3) {
          selectedAvatar = 'riley';
        } else {
          selectedAvatar = Math.random() < 0.5 ? 'riley' : 'raven';
        }
      } else if (newAnswers.relationshipType === 'Male') {
        selectedAvatar = 'jake';
      }

      const connectionType = newAnswers.connectionType?.includes('friend') ? 'friend' : 'romantic';

      const matchData = {
        userName: newAnswers.name,
        userBirthday: newAnswers.birthday,
        relationshipType: newAnswers.relationshipType,
        connectionType,
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
