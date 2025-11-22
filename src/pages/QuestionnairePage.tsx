import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

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
    question: 'What Do People Call You?',
    placeholder: 'Enter your name'
  },
  {
    id: 'birthday',
    type: 'date',
    question: "When's Your Birthday?"
  },
  {
    id: 'relationshipType',
    type: 'choice',
    question: 'What Are You Looking For?',
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
    question: 'Is Your Dream Girl...',
    options: [
      { text: 'The life Of The Party', score: { riley: 1 } },
      { text: 'Lives In Her Own World', score: { goth: 1 } }
    ]
  },
  {
    id: 'interest',
    type: 'choice',
    question: 'How Does She Show Interest In You?',
    options: [
      { text: 'Flirty & Bold', score: { riley: 1 } },
      { text: 'Reserved & Subtle', score: { goth: 1 } }
    ]
  },
  {
    id: 'vibe',
    type: 'choice',
    question: 'What Vibe Are You Drawn To?',
    options: [
      { text: 'Bright, energetic, always smiling', score: { riley: 1 } },
      { text: 'Mysterious, deep, keeps you guessing', score: { goth: 1 } }
    ]
  },
  {
    id: 'dynamic',
    type: 'choice',
    question: 'What Dynamic Do You Prefer?',
    options: [
      { text: 'She takes the lead' },
      { text: 'You both share control equally' },
      { text: 'You prefer to lead' }
    ]
  },
  {
    id: 'confrontation',
    type: 'choice',
    question: 'How Should She Handle Disagreements?',
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
    question: 'How Available Should She Be?',
    options: [
      { text: 'Always There When I Need Her' },
      { text: 'Mostly Available But Has Her Own Life' },
      { text: 'Independent - Texts When She Can' }
    ]
  },
  {
    id: 'interests',
    type: 'choice',
    question: 'What Interests Does She have?',
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
    question: 'Is Your Dream Guy...',
    options: [
      { text: 'The life Of The Party' },
      { text: 'In His Own World' }
    ]
  },
  {
    id: 'interest',
    type: 'choice',
    question: 'How Does He Show Interest In You?',
    options: [
      { text: 'Flirty And Bold' },
      { text: 'Reserved And Subtle' }
    ]
  },
  {
    id: 'vibe',
    type: 'choice',
    question: 'What Vibe Are YOU Drawn To?',
    options: [
      { text: 'Bright, energetic, always happy' },
      { text: 'Mysterious, deep, keeps you guessing' }
    ]
  },
  {
    id: 'dynamic',
    type: 'choice',
    question: 'What dynamic Do You Prefer?',
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

        <div className="mb-8">
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
              className="bg-gradient-to-r from-rose-500 to-pink-500 h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 text-center mb-12">
            {question.question}
          </h2>

          {question.type === 'text' && (
            <div className="space-y-4">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={question.placeholder}
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:border-rose-400 focus:outline-none transition-colors"
                onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                autoFocus
              />
              <button
                onClick={handleTextSubmit}
                disabled={!textInput.trim()}
                className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:transform-none"
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
                className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-xl focus:border-rose-400 focus:outline-none transition-colors"
                autoFocus
              />
              <button
                onClick={() => handleDateSubmit(textInput)}
                disabled={!textInput}
                className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:transform-none"
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
                  onClick={() => handleAnswer(option.text, option.score)}
                  className="w-full text-left px-6 py-4 rounded-xl border-2 border-gray-200 hover:border-rose-400 hover:bg-rose-50 transition-all duration-200 text-lg font-medium text-gray-700 hover:text-rose-600 hover:shadow-md"
                >
                  {option.text}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Take your time - there are no wrong answers
          </p>
        </div>
      </div>
    </div>
  );
}
