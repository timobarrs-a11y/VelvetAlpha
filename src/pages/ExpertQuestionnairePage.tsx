import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../shared/supabase/client';
import { createCompanion } from '../services/companionService';

interface ExpertAnswer {
  gender?: string;
  energyPreference?: string;
  communicationStyle?: string;
  supportStyle?: string;
  conversationDepth?: string;
  customName?: string;
}

interface QuestionConfig {
  id: keyof ExpertAnswer;
  type: 'choice' | 'text';
  question: string;
  placeholder?: string;
  options?: string[];
}

const QUESTIONS: QuestionConfig[] = [
  {
    id: 'gender',
    type: 'choice',
    question: 'What gender would you like your expert to be?',
    options: ['Female', 'Male'],
  },
  {
    id: 'energyPreference',
    type: 'choice',
    question: "What's your energy like right now?",
    options: [
      'Working hard, need motivation',
      'Going through a tough time, need support',
      'Doing well, want to level up faster',
      'Bored, looking for direction',
    ],
  },
  {
    id: 'communicationStyle',
    type: 'choice',
    question: 'How do you like to communicate?',
    options: [
      'Very direct — just tell me what to do',
      'Balanced — explain the why, then the what',
      'Diplomatic — guide me without being pushy',
      'Conversational — make it feel natural',
    ],
  },
  {
    id: 'supportStyle',
    type: 'choice',
    question: "How do you want support when you're struggling?",
    options: [
      'Solutions — help me fix it',
      'Just listen and validate',
      'Distract me, then come back to it',
      'Give me space but check in later',
    ],
  },
  {
    id: 'conversationDepth',
    type: 'choice',
    question: 'How deep should conversations go?',
    options: [
      'Keep it focused and practical',
      'Mix of tactical and philosophical',
      'Go deep — I want to understand the why behind everything',
    ],
  },
  {
    id: 'customName',
    type: 'text',
    question: "What should your expert's name be?",
    placeholder: 'Enter a name...',
  },
];

export function ExpertQuestionnairePage() {
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<ExpertAnswer>({});
  const [textInput, setTextInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const question = QUESTIONS[currentQuestion];
  const totalQuestions = QUESTIONS.length;
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;

  useEffect(() => {
    if (question.type === 'text' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentQuestion, question.type]);

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevQuestion = QUESTIONS[currentQuestion - 1];
      const prev = answers[prevQuestion.id];
      if (prevQuestion.type === 'text') {
        setTextInput(typeof prev === 'string' ? prev : '');
      }
      setSelectedOption(null);
    }
  };

  const handleChoiceClick = (index: number, answer: string) => {
    setSelectedOption(index);
    const newAnswers = { ...answers, [question.id]: answer };
    setAnswers(newAnswers);

    setTimeout(() => {
      if (currentQuestion === totalQuestions - 1) {
        completeQuestionnaire(newAnswers);
      } else {
        setCurrentQuestion(currentQuestion + 1);
        setTextInput('');
        setSelectedOption(null);
      }
    }, 300);
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      const newAnswers = { ...answers, [question.id]: textInput.trim() };
      setAnswers(newAnswers);
      completeQuestionnaire(newAnswers);
    }
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTextSubmit();
    }
  };

  const completeQuestionnaire = async (finalAnswers: ExpertAnswer) => {
    sessionStorage.setItem('expertMatchAnswers', JSON.stringify(finalAnswers));

    const expertId = sessionStorage.getItem('selectedExpertId');
    const expertSource = sessionStorage.getItem('selectedExpertSource') as 'curated' | 'user' | null;
    const gender: 'male' | 'female' = finalAnswers.gender === 'Male' ? 'male' : 'female';
    const customName = finalAnswers.customName || 'Mentor';

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }

      const companion = await createCompanion({
        userId: user.id,
        gender,
        relationshipType: 'mentor',
        customName,
        hobbies: [],
        signatureExpert: expertId || undefined,
        signatureExpertSource: expertSource || undefined,
        energyPreference: finalAnswers.energyPreference,
        communicationStyle: finalAnswers.communicationStyle,
        supportStyle: finalAnswers.supportStyle,
        conversationDepth: finalAnswers.conversationDepth,
      });

      if (companion) {
        sessionStorage.setItem('currentCompanionId', companion.id);

        const matchData = {
          userName: '',
          userGender: '',
          relationshipType: finalAnswers.gender || 'Female',
          connectionType: 'mentor',
          companionName: customName,
          energyPreference: finalAnswers.energyPreference,
          communicationStyle: finalAnswers.communicationStyle,
          supportStyle: finalAnswers.supportStyle,
          conversationDepth: finalAnswers.conversationDepth,
        };
        sessionStorage.setItem('matchAnswers', JSON.stringify(matchData));

        navigate('/create-companion-avatar', { replace: true });
      } else {
        setCreating(false);
      }
    } catch (error) {
      console.error('[ExpertQuestionnaire] Error creating companion:', error);
      setCreating(false);
    }
  };

  const isChoiceQuestion = question.type === 'choice';

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative">
      {creating && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
            <p className="text-gray-300 font-medium">Creating your coach...</p>
          </div>
        </div>
      )}
      {/* Subtle background gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-purple-600/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[400px] rounded-full bg-blue-600/5 blur-[100px]" />
      </div>

      <motion.div
        className="max-w-lg w-full relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Back button */}
        {currentQuestion > 0 && (
          <motion.button
            onClick={handleBack}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="text-sm font-medium">Back</span>
          </motion.button>
        )}

        {/* Progress bar */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-medium text-gray-500">
              {currentQuestion + 1} / {totalQuestions}
            </span>
          </div>
          <div className="w-full bg-gray-800/50 rounded-full h-1 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-1 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Question container */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-white mb-8 leading-tight">
                {question.question}
              </h2>

              {isChoiceQuestion && question.options ? (
                <div className="space-y-3">
                  {question.options.map((option, idx) => (
                    <motion.button
                      key={idx}
                      onClick={() => handleChoiceClick(idx, option)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      animate={{
                        backgroundColor:
                          selectedOption === idx
                            ? 'rgb(88, 28, 135)'
                            : 'rgb(31, 41, 55)',
                      }}
                      className="w-full text-left px-6 py-4 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 hover:border-gray-600"
                    >
                      <span className="text-white font-medium">{option}</span>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={handleTextKeyDown}
                    placeholder={question.placeholder}
                    className="flex-1 px-6 py-4 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <motion.button
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim()}
                    whileHover={{ scale: textInput.trim() ? 1.05 : 1 }}
                    whileTap={{ scale: textInput.trim() ? 0.95 : 1 }}
                    className="px-6 py-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-600 text-white font-medium transition-all flex items-center gap-2"
                  >
                    <ChevronRight size={20} />
                  </motion.button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Subtle hint text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-gray-600 mt-6"
        >
          {currentQuestion === totalQuestions - 1
            ? 'Almost done!'
            : `${totalQuestions - currentQuestion - 1} question${totalQuestions - currentQuestion - 1 !== 1 ? 's' : ''} remaining`}
        </motion.p>
      </motion.div>
    </div>
  );
}
