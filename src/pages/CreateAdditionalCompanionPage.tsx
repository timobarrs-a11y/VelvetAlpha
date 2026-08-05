import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../shared/supabase/client';
import { createCompanion } from '../services/companionService';
import { userProfileService } from '../services/userProfileService';

interface QuestionData {
  id: string;
  type: 'text' | 'date' | 'choice' | 'multi-choice';
  question: string;
  placeholder?: string;
  options?: Array<{ text: string }>;
  maxSelections?: number;
  minSelections?: number;
}

const COMPANION_BASE_QUESTIONS: QuestionData[] = [
  {
    id: 'relationshipType',
    type: 'choice',
    question: 'Which Companion Are You Creating?',
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
      { text: 'Just a friend to talk to' },
      { text: 'Something more...' }
    ]
  }
];

const GIRLFRIEND_QUESTIONS: QuestionData[] = [
  {
    id: 'energy',
    type: 'choice',
    question: 'Picture Your Dream Girl... Is She:',
    options: [
      { text: 'The Life Of The Party' },
      { text: 'Lives In Her Own World' }
    ]
  },
  {
    id: 'flirtingStyle',
    type: 'choice',
    question: 'When She Likes You, How Does She Show It?',
    options: [
      { text: 'Direct & Bold - Makes The First Move' },
      { text: 'Playful Teasing - Flirts Through Banter' },
      { text: 'Subtle & Sweet - Small Gestures & Eye Contact' },
      { text: 'Mysterious & Reserved - Keeps You Guessing' }
    ]
  },
  {
    id: 'humorStyle',
    type: 'choice',
    question: 'What Kind Of Humor Makes You Laugh?',
    options: [
      { text: 'Witty & Clever - Smart Jokes & Wordplay' },
      { text: 'Goofy & Random - Silly & Unpredictable' },
      { text: 'Sarcastic & Dry - Subtle & Deadpan' },
      { text: 'Warm & Light - Positive & Feel-Good Humor' }
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
  },
  {
    id: 'loveLanguage',
    type: 'choice',
    question: 'How Do You Like To Feel Cared About?',
    options: [
      { text: 'Words Of Affirmation & Encouragement' },
      { text: 'Quality Time & Deep Conversations' },
      { text: 'Thoughtful Gestures & Gifts' },
      { text: 'Acts Of Service & Practical Help' }
    ]
  },
  {
    id: 'supportStyle',
    type: 'choice',
    question: "When You're Stressed, You Want Someone Who:",
    options: [
      { text: 'Offers Solutions & Helps You Fix It' },
      { text: 'Just Listens & Validates Feelings' },
      { text: 'Distracts You With Fun & Positivity' },
      { text: 'Gives You Space But Checks In' }
    ]
  },
  {
    id: 'lifeContext',
    type: 'choice',
    question: 'Right Now, You Are Mostly:',
    options: [
      { text: 'Working/Studying Hard, Need Motivation' },
      { text: 'Going Through A Tough Time, Need Support' },
      { text: 'Doing Well, Want Someone To Share It With' },
      { text: 'Bored/Lonely, Want Companionship' }
    ]
  },
  {
    id: 'communication',
    type: 'choice',
    question: 'How Does She Communicate With You?',
    options: [
      { text: 'Very Direct & Straightforward - Says Exactly What She Means' },
      { text: 'Diplomatic & Tactful - Gentle, Considers Your Feelings' },
      { text: 'Playfully Indirect - Hints, Teases, Makes You Guess' },
      { text: 'Subtle & Suggestive - Reads Between Lines' }
    ]
  },
  {
    id: 'emotionalOpenness',
    type: 'choice',
    question: 'When It Comes To Her Feelings:',
    options: [
      { text: 'Open Book - Shares Everything Freely' },
      { text: 'Opens Up Over Time - Shares More As Trust Builds' },
      { text: 'Selectively Vulnerable - Shares Deep Stuff Occasionally' },
      { text: 'Private & Guarded - Keeps Feelings Mostly To Herself' }
    ]
  },
  {
    id: 'conversationDepth',
    type: 'choice',
    question: 'In Your Conversations, You Prefer:',
    options: [
      { text: 'Fun & Light-Hearted - Memes, Trends, Daily Life' },
      { text: 'Deep & Meaningful - Life, Dreams, Philosophy' },
      { text: 'Perfect Mix Of Both - Sometimes Deep, Sometimes Silly' },
      { text: 'Whatever The Moment Feels Like - No Preference' }
    ]
  },
  {
    id: 'expressiveness',
    type: 'choice',
    question: 'How Does She Express Herself?',
    options: [
      { text: 'Very Animated - Lots Of Emojis & Actions, Super Expressive' },
      { text: 'Balanced Expression - Uses Emojis & Actions Naturally' },
      { text: 'Subtle & Minimal - Occasional Emoji When It Matters' },
      { text: 'Words Over Symbols - Expresses Through What She Says' }
    ]
  },
  {
    id: 'initiative',
    type: 'choice',
    question: 'Who Drives The Conversation?',
    options: [
      { text: 'She Leads - Starts Topics, Asks Questions, Takes Initiative' },
      { text: 'You Both Share - Back-And-Forth, Equal Engagement' },
      { text: 'She Follows Your Lead - Responds Well, Lets You Steer' },
      { text: 'Spontaneous & Random - Sometimes Her, Sometimes You' }
    ]
  },
  {
    id: 'companionName',
    type: 'text',
    question: "What's Your Companion's Name?",
    placeholder: 'Enter name'
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
    id: 'flirtingStyle',
    type: 'choice',
    question: 'When He Likes You, How Does He Show It?',
    options: [
      { text: 'Direct & Bold - Makes The First Move' },
      { text: 'Playful Teasing - Flirts Through Banter' },
      { text: 'Subtle & Sweet - Small Gestures & Eye Contact' },
      { text: 'Mysterious & Reserved - Keeps You Guessing' }
    ]
  },
  {
    id: 'humorStyle',
    type: 'choice',
    question: 'What Kind Of Humor Makes You Laugh?',
    options: [
      { text: 'Witty & Clever - Smart Jokes & Wordplay' },
      { text: 'Goofy & Random - Silly & Unpredictable' },
      { text: 'Sarcastic & Dry - Subtle & Deadpan' },
      { text: 'Warm & Light - Positive & Feel-Good Humor' }
    ]
  },
  {
    id: 'dynamic',
    type: 'choice',
    question: 'In A Relationship, You Prefer:',
    options: [
      { text: 'He Takes The Lead' },
      { text: 'You Both Share Control Equally' },
      { text: 'You Prefer To Lead' }
    ]
  },
  {
    id: 'confrontation',
    type: 'choice',
    question: 'When Things Get Tense, He Should:',
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
    question: 'How Much Of His Time Do You Want?',
    options: [
      { text: 'Always There When I Need Him' },
      { text: 'Mostly Available But Has His Own Life' },
      { text: 'Independent - Texts When He Can' }
    ]
  },
  {
    id: 'interests',
    type: 'choice',
    question: "What's He Passionate About?",
    options: [
      { text: 'Pop Culture, Social Media, Trending Topics' },
      { text: 'Books, Philosophy, Deep Discussions' },
      { text: 'Wellness, Fitness, Personal Growth' },
      { text: 'Adventure, Travel, New Experiences' }
    ]
  },
  {
    id: 'loveLanguage',
    type: 'choice',
    question: 'How Do You Like To Feel Cared About?',
    options: [
      { text: 'Words Of Affirmation & Encouragement' },
      { text: 'Quality Time & Deep Conversations' },
      { text: 'Thoughtful Gestures & Gifts' },
      { text: 'Acts Of Service & Practical Help' }
    ]
  },
  {
    id: 'supportStyle',
    type: 'choice',
    question: "When You're Stressed, You Want Someone Who:",
    options: [
      { text: 'Offers Solutions & Helps You Fix It' },
      { text: 'Just Listens & Validates Feelings' },
      { text: 'Distracts You With Fun & Positivity' },
      { text: 'Gives You Space But Checks In' }
    ]
  },
  {
    id: 'lifeContext',
    type: 'choice',
    question: 'Right Now, You Are Mostly:',
    options: [
      { text: 'Working/Studying Hard, Need Motivation' },
      { text: 'Going Through A Tough Time, Need Support' },
      { text: 'Doing Well, Want Someone To Share It With' },
      { text: 'Bored/Lonely, Want Companionship' }
    ]
  },
  {
    id: 'communication',
    type: 'choice',
    question: 'How Does He Communicate With You?',
    options: [
      { text: 'Very Direct & Straightforward - Says Exactly What He Means' },
      { text: 'Diplomatic & Tactful - Gentle, Considers Your Feelings' },
      { text: 'Playfully Indirect - Hints, Teases, Makes You Guess' },
      { text: 'Subtle & Suggestive - Reads Between Lines' }
    ]
  },
  {
    id: 'emotionalOpenness',
    type: 'choice',
    question: 'When It Comes To His Feelings:',
    options: [
      { text: 'Open Book - Shares Everything Freely' },
      { text: 'Opens Up Over Time - Shares More As Trust Builds' },
      { text: 'Selectively Vulnerable - Shares Deep Stuff Occasionally' },
      { text: 'Private & Guarded - Keeps Feelings Mostly To Himself' }
    ]
  },
  {
    id: 'conversationDepth',
    type: 'choice',
    question: 'In Your Conversations, You Prefer:',
    options: [
      { text: 'Fun & Light-Hearted - Memes, Trends, Daily Life' },
      { text: 'Deep & Meaningful - Life, Dreams, Philosophy' },
      { text: 'Perfect Mix Of Both - Sometimes Deep, Sometimes Silly' },
      { text: 'Whatever The Moment Feels Like - No Preference' }
    ]
  },
  {
    id: 'expressiveness',
    type: 'choice',
    question: 'How Does He Express Himself?',
    options: [
      { text: 'Very Animated - Lots Of Emojis & Actions, Super Expressive' },
      { text: 'Balanced Expression - Uses Emojis & Actions Naturally' },
      { text: 'Subtle & Minimal - Occasional Emoji When It Matters' },
      { text: 'Words Over Symbols - Expresses Through What He Says' }
    ]
  },
  {
    id: 'initiative',
    type: 'choice',
    question: 'Who Drives The Conversation?',
    options: [
      { text: 'He Leads - Starts Topics, Asks Questions, Takes Initiative' },
      { text: 'You Both Share - Back-And-Forth, Equal Engagement' },
      { text: 'He Follows Your Lead - Responds Well, Lets You Steer' },
      { text: 'Spontaneous & Random - Sometimes Him, Sometimes You' }
    ]
  },
  {
    id: 'companionName',
    type: 'text',
    question: "What's Your Companion's Name?",
    placeholder: 'Enter name'
  }
];

const FEMALE_FRIEND_QUESTIONS: QuestionData[] = [
  {
    id: 'energy',
    type: 'choice',
    question: 'Picture Your Ideal Friend... Is She:',
    options: [
      { text: 'The Life Of The Party' },
      { text: 'Somewhere In Between' },
      { text: 'Lives In Her Own World' }
    ]
  },
  {
    id: 'flirtingStyle',
    type: 'choice',
    question: "When She's Excited To Hang Out, How Does She Show It?",
    options: [
      { text: 'Direct & Bold - Makes The First Move' },
      { text: 'Playful Teasing - Flirts Through Banter' },
      { text: 'Subtle & Sweet - Small Gestures & Eye Contact' },
      { text: 'Mysterious & Reserved - Keeps You Guessing' }
    ]
  },
  {
    id: 'humorStyle',
    type: 'choice',
    question: 'What Kind Of Humor Makes You Laugh?',
    options: [
      { text: 'Witty & Clever - Smart Jokes & Wordplay' },
      { text: 'Goofy & Random - Silly & Unpredictable' },
      { text: 'Sarcastic & Dry - Subtle & Deadpan' },
      { text: 'Warm & Light - Positive & Feel-Good Humor' }
    ]
  },
  {
    id: 'dynamic',
    type: 'choice',
    question: 'In Your Friendship, You Prefer:',
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
  },
  {
    id: 'loveLanguage',
    type: 'choice',
    question: 'How Do You Like To Feel Cared About?',
    options: [
      { text: 'Words Of Affirmation & Encouragement' },
      { text: 'Quality Time & Deep Conversations' },
      { text: 'Thoughtful Gestures & Gifts' },
      { text: 'Acts Of Service & Practical Help' }
    ]
  },
  {
    id: 'supportStyle',
    type: 'choice',
    question: "When You're Stressed, You Want Someone Who:",
    options: [
      { text: 'Offers Solutions & Helps You Fix It' },
      { text: 'Just Listens & Validates Feelings' },
      { text: 'Distracts You With Fun & Positivity' },
      { text: 'Gives You Space But Checks In' }
    ]
  },
  {
    id: 'lifeContext',
    type: 'choice',
    question: 'Right Now, You Are Mostly:',
    options: [
      { text: 'Working/Studying Hard, Need Motivation' },
      { text: 'Going Through A Tough Time, Need Support' },
      { text: 'Doing Well, Want Someone To Share It With' },
      { text: 'Bored/Lonely, Want Companionship' }
    ]
  },
  {
    id: 'communication',
    type: 'choice',
    question: 'How Does She Communicate With You?',
    options: [
      { text: 'Very Direct & Straightforward - Says Exactly What She Means' },
      { text: 'Diplomatic & Tactful - Gentle, Considers Your Feelings' },
      { text: 'Playfully Indirect - Hints, Teases, Makes You Guess' },
      { text: 'Subtle & Suggestive - Reads Between Lines' }
    ]
  },
  {
    id: 'emotionalOpenness',
    type: 'choice',
    question: 'When It Comes To Her Feelings:',
    options: [
      { text: 'Open Book - Shares Everything Freely' },
      { text: 'Opens Up Over Time - Shares More As Trust Builds' },
      { text: 'Selectively Vulnerable - Shares Deep Stuff Occasionally' },
      { text: 'Private & Guarded - Keeps Feelings Mostly To Herself' }
    ]
  },
  {
    id: 'conversationDepth',
    type: 'choice',
    question: 'In Your Conversations, You Prefer:',
    options: [
      { text: 'Fun & Light-Hearted - Memes, Trends, Daily Life' },
      { text: 'Deep & Meaningful - Life, Dreams, Philosophy' },
      { text: 'Perfect Mix Of Both - Sometimes Deep, Sometimes Silly' },
      { text: 'Whatever The Moment Feels Like - No Preference' }
    ]
  },
  {
    id: 'expressiveness',
    type: 'choice',
    question: 'How Does She Express Herself?',
    options: [
      { text: 'Very Animated - Lots Of Emojis & Actions, Super Expressive' },
      { text: 'Balanced Expression - Uses Emojis & Actions Naturally' },
      { text: 'Subtle & Minimal - Occasional Emoji When It Matters' },
      { text: 'Words Over Symbols - Expresses Through What She Says' }
    ]
  },
  {
    id: 'initiative',
    type: 'choice',
    question: 'Who Drives The Conversation?',
    options: [
      { text: 'She Leads - Starts Topics, Asks Questions, Takes Initiative' },
      { text: 'You Both Share - Back-And-Forth, Equal Engagement' },
      { text: 'She Follows Your Lead - Responds Well, Lets You Steer' },
      { text: 'Spontaneous & Random - Sometimes Her, Sometimes You' }
    ]
  },
  {
    id: 'companionName',
    type: 'text',
    question: 'What Would Be The Perfect Name For That Person?',
    placeholder: 'Enter a name...'
  }
];

const MALE_FRIEND_QUESTIONS: QuestionData[] = [
  {
    id: 'energy',
    type: 'choice',
    question: 'Picture Your Ideal Friend... Is He:',
    options: [
      { text: 'The Life Of The Party' },
      { text: 'Somewhere In Between' },
      { text: 'In His Own World' }
    ]
  },
  {
    id: 'flirtingStyle',
    type: 'choice',
    question: "When He's Excited To Hang Out, How Does He Show It?",
    options: [
      { text: 'Direct & Bold - Makes The First Move' },
      { text: 'Playful Teasing - Flirts Through Banter' },
      { text: 'Subtle & Sweet - Small Gestures & Eye Contact' },
      { text: 'Mysterious & Reserved - Keeps You Guessing' }
    ]
  },
  {
    id: 'humorStyle',
    type: 'choice',
    question: 'What Kind Of Humor Makes You Laugh?',
    options: [
      { text: 'Witty & Clever - Smart Jokes & Wordplay' },
      { text: 'Goofy & Random - Silly & Unpredictable' },
      { text: 'Sarcastic & Dry - Subtle & Deadpan' },
      { text: 'Warm & Light - Positive & Feel-Good Humor' }
    ]
  },
  {
    id: 'dynamic',
    type: 'choice',
    question: 'In Your Friendship, You Prefer:',
    options: [
      { text: 'He Takes The Lead' },
      { text: 'You Both Share Control Equally' },
      { text: 'You Prefer To Lead' }
    ]
  },
  {
    id: 'confrontation',
    type: 'choice',
    question: 'When Things Get Tense, He Should:',
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
    question: 'How Much Of His Time Do You Want?',
    options: [
      { text: 'Always There When I Need Him' },
      { text: 'Mostly Available But Has His Own Life' },
      { text: 'Independent - Texts When He Can' }
    ]
  },
  {
    id: 'interests',
    type: 'choice',
    question: "What's He Passionate About?",
    options: [
      { text: 'Pop Culture, Social Media, Trending Topics' },
      { text: 'Books, Philosophy, Deep Discussions' },
      { text: 'Wellness, Fitness, Personal Growth' },
      { text: 'Adventure, Travel, New Experiences' }
    ]
  },
  {
    id: 'loveLanguage',
    type: 'choice',
    question: 'How Do You Like To Feel Cared About?',
    options: [
      { text: 'Words Of Affirmation & Encouragement' },
      { text: 'Quality Time & Deep Conversations' },
      { text: 'Thoughtful Gestures & Gifts' },
      { text: 'Acts Of Service & Practical Help' }
    ]
  },
  {
    id: 'supportStyle',
    type: 'choice',
    question: "When You're Stressed, You Want Someone Who:",
    options: [
      { text: 'Offers Solutions & Helps You Fix It' },
      { text: 'Just Listens & Validates Feelings' },
      { text: 'Distracts You With Fun & Positivity' },
      { text: 'Gives You Space But Checks In' }
    ]
  },
  {
    id: 'lifeContext',
    type: 'choice',
    question: 'Right Now, You Are Mostly:',
    options: [
      { text: 'Working/Studying Hard, Need Motivation' },
      { text: 'Going Through A Tough Time, Need Support' },
      { text: 'Doing Well, Want Someone To Share It With' },
      { text: 'Bored/Lonely, Want Companionship' }
    ]
  },
  {
    id: 'communication',
    type: 'choice',
    question: 'How Does He Communicate With You?',
    options: [
      { text: 'Very Direct & Straightforward - Says Exactly What He Means' },
      { text: 'Diplomatic & Tactful - Gentle, Considers Your Feelings' },
      { text: 'Playfully Indirect - Hints, Teases, Makes You Guess' },
      { text: 'Subtle & Suggestive - Reads Between Lines' }
    ]
  },
  {
    id: 'emotionalOpenness',
    type: 'choice',
    question: 'When It Comes To His Feelings:',
    options: [
      { text: 'Open Book - Shares Everything Freely' },
      { text: 'Opens Up Over Time - Shares More As Trust Builds' },
      { text: 'Selectively Vulnerable - Shares Deep Stuff Occasionally' },
      { text: 'Private & Guarded - Keeps Feelings Mostly To Himself' }
    ]
  },
  {
    id: 'conversationDepth',
    type: 'choice',
    question: 'In Your Conversations, You Prefer:',
    options: [
      { text: 'Fun & Light-Hearted - Memes, Trends, Daily Life' },
      { text: 'Deep & Meaningful - Life, Dreams, Philosophy' },
      { text: 'Perfect Mix Of Both - Sometimes Deep, Sometimes Silly' },
      { text: 'Whatever The Moment Feels Like - No Preference' }
    ]
  },
  {
    id: 'expressiveness',
    type: 'choice',
    question: 'How Does He Express Himself?',
    options: [
      { text: 'Very Animated - Lots Of Emojis & Actions, Super Expressive' },
      { text: 'Balanced Expression - Uses Emojis & Actions Naturally' },
      { text: 'Subtle & Minimal - Occasional Emoji When It Matters' },
      { text: 'Words Over Symbols - Expresses Through What He Says' }
    ]
  },
  {
    id: 'initiative',
    type: 'choice',
    question: 'Who Drives The Conversation?',
    options: [
      { text: 'He Leads - Starts Topics, Asks Questions, Takes Initiative' },
      { text: 'You Both Share - Back-And-Forth, Equal Engagement' },
      { text: 'He Follows Your Lead - Responds Well, Lets You Steer' },
      { text: 'Spontaneous & Random - Sometimes Him, Sometimes You' }
    ]
  },
  {
    id: 'companionName',
    type: 'text',
    question: 'What Would Be The Perfect Name For That Person?',
    placeholder: 'Enter a name...'
  }
];

export function CreateAdditionalCompanionPage() {
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [textInput, setTextInput] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null);
  const [lastMilestone, setLastMilestone] = useState(0);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserName();
  }, []);

  const loadUserName = async () => {
    try {
      const profile = await userProfileService.getCurrentProfile();
      if (profile?.name) {
        setUserName(profile.name);
        setAnswers({ name: profile.name });
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading user name:', error);
      setLoading(false);
    }
  };

  const getQuestions = (): QuestionData[] => {
    const base = [...COMPANION_BASE_QUESTIONS];

    if (!answers.relationshipType) {
      return base;
    }

    const isFriend = typeof answers.connectionType === 'string' && answers.connectionType.includes('friend');

    if (answers.relationshipType === 'Male') {
      return [...base, ...(isFriend ? MALE_FRIEND_QUESTIONS : BOYFRIEND_QUESTIONS)];
    }

    return [...base, ...(isFriend ? FEMALE_FRIEND_QUESTIONS : GIRLFRIEND_QUESTIONS)];
  };

  const QUESTIONS = getQuestions();
  const question = QUESTIONS[currentQuestion];

  const getQuestionText = (q: QuestionData): string => {
    if (q.id === 'connectionType' && userName) {
      return `So ${userName}, What Kind Of Connection Are You Looking For?`;
    }
    if (q.id === 'companionName' && userName) {
      return `Last thing ${userName} -- What's Your Companion's Name?`;
    }
    return q.question;
  };

  const totalQuestions = QUESTIONS.length;
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;

  useEffect(() => {
    const currentMilestone = Math.floor(progress / 25) * 25;
    if (currentMilestone > lastMilestone && currentMilestone >= 25 && currentMilestone <= 75) {
      const messages: Record<number, string> = {
        25: "You're doing great!",
        50: "Halfway there!",
        75: "Almost done!"
      };
      setMilestoneMessage(messages[currentMilestone]);
      setLastMilestone(currentMilestone);
      setTimeout(() => setMilestoneMessage(null), 2000);
    }
  }, [progress, lastMilestone]);

  const getProgressGradient = () => {
    if (progress >= 75) return 'from-pink-600 to-rose-600';
    if (progress >= 50) return 'from-rose-600 to-pink-600';
    if (progress >= 25) return 'from-rose-500 to-pink-500';
    return 'from-rose-400 to-pink-400';
  };

  const getSubtitle = () => {
    if (currentQuestion === 0) {
      return `Welcome back, ${userName || 'friend'}! Let's create a new companion.`;
    }
    if (progress >= 80) return 'Almost there... getting exciting!';
    if (progress >= 40) return "You're doing great! Just a few more questions...";
    return 'Take your time - we want to find your perfect match';
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevQuestion = QUESTIONS[currentQuestion - 1];
      setTextInput(answers[prevQuestion.id] || '');
    }
  };

  const createCompanionFromAnswers = async (allAnswers: Record<string, any>): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const gender: 'male' | 'female' = allAnswers.relationshipType === 'Male' ? 'male' : 'female';
      const connectionType = allAnswers.connectionType?.includes('friend') ? 'friend' : 'romantic';

      const companion = await createCompanion({
        userId: user.id,
        customName: allAnswers.companionName || 'Companion',
        gender,
        energyPreference: allAnswers.energy || '',
        flirtingStyle: allAnswers.flirtingStyle || '',
        humorStyle: allAnswers.humorStyle || '',
        dynamicPreference: allAnswers.dynamic || '',
        confrontationStyle: allAnswers.confrontation || '',
        availabilityLevel: allAnswers.availability || '',
        interestPreference: allAnswers.interests || '',
        interestText: allAnswers.interests || '',
        loveLanguage: allAnswers.loveLanguage || '',
        supportStyle: allAnswers.supportStyle || '',
        lifeContext: allAnswers.lifeContext || '',
        communicationStyle: allAnswers.communication || '',
        emotionalOpenness: allAnswers.emotionalOpenness || '',
        conversationDepth: allAnswers.conversationDepth || '',
        expressiveness: allAnswers.expressiveness || '',
        initiative: allAnswers.initiative || '',
        hobbies: allAnswers.interests ? [allAnswers.interests] : [],
        relationshipType: connectionType,
        signatureExpert: sessionStorage.getItem('selectedExpertId') || undefined,
        signatureExpertSource: (sessionStorage.getItem('selectedExpertSource') as 'curated' | 'user') || undefined,
        questionnaireData: {
          userName: allAnswers.name || '',
          userBirthday: allAnswers.birthday || '',
          userGender: allAnswers.gender || '',
          hobbies: allAnswers.interests || '',
          sports: allAnswers.sports || '',
          relationshipType: allAnswers.relationshipType as 'Male' | 'Female',
          connectionType: connectionType as 'friend' | 'romantic',
          energyPreference: allAnswers.energy,
          dynamicPreference: allAnswers.dynamic,
          confrontationStyle: allAnswers.confrontation,
          availabilityLevel: allAnswers.availability,
          interestPreference: allAnswers.interests,
          loveLanguage: allAnswers.loveLanguage,
          supportStyle: allAnswers.supportStyle,
          lifeContext: allAnswers.lifeContext,
          communicationStyle: allAnswers.communication,
          emotionalOpenness: allAnswers.emotionalOpenness,
          conversationDepth: allAnswers.conversationDepth,
          expressiveness: allAnswers.expressiveness,
          initiative: allAnswers.initiative,
          companionName: allAnswers.companionName || 'Companion'
        }
      });

      if (companion && companion.id) {
        sessionStorage.setItem('currentCompanionId', companion.id);
        sessionStorage.setItem('onboardingIntent', 'connection');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error creating companion:', error);
      return false;
    }
  };

  const handleNext = async () => {
    const newAnswers = { ...answers };
    if (question.type === 'text') {
      newAnswers[question.id] = textInput;
    } else if (question.type === 'choice') {
      newAnswers[question.id] = selectedOptions[0] || '';
    } else if (question.type === 'multi-choice') {
      newAnswers[question.id] = selectedOptions;
    }

    setAnswers(newAnswers);
    setTextInput('');
    setSelectedOptions([]);

    const isFriend = typeof newAnswers.connectionType === 'string' && newAnswers.connectionType.includes('friend');
    let fullQuestions = QUESTIONS;
    if (!newAnswers.relationshipType) {
      fullQuestions = COMPANION_BASE_QUESTIONS;
    } else if (newAnswers.relationshipType === 'Male') {
      fullQuestions = [...COMPANION_BASE_QUESTIONS, ...(isFriend ? MALE_FRIEND_QUESTIONS : BOYFRIEND_QUESTIONS)];
    } else {
      fullQuestions = [...COMPANION_BASE_QUESTIONS, ...(isFriend ? FEMALE_FRIEND_QUESTIONS : GIRLFRIEND_QUESTIONS)];
    }

    if (currentQuestion === fullQuestions.length - 1) {
      const created = await createCompanionFromAnswers(newAnswers);
      if (created) {
        navigate('/voice-selection');
      } else {
        navigate('/lobby');
      }
    } else {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handleOptionSelect = (option: string) => {
    if (question.type === 'choice') {
      setSelectedOptions([option]);
    } else if (question.type === 'multi-choice') {
      const maxSelections = question.maxSelections || 10;
      if (selectedOptions.includes(option)) {
        setSelectedOptions(selectedOptions.filter(o => o !== option));
      } else if (selectedOptions.length < maxSelections) {
        setSelectedOptions([...selectedOptions, option]);
      }
    }
  };

  const canProceed = () => {
    if (question.type === 'text') {
      return textInput.trim().length > 0;
    }
    if (question.type === 'choice') {
      return selectedOptions.length > 0;
    }
    if (question.type === 'multi-choice') {
      const minSelections = question.minSelections || 1;
      return selectedOptions.length >= minSelections;
    }
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-rose-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-rose-900 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-3xl shadow-2xl p-8">
          {currentQuestion > 0 && (
            <button
              onClick={handleBack}
              className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-medium">Back</span>
            </button>
          )}

          <div className="mb-8">
            <div className="w-full bg-gray-700/50 rounded-full h-3 mb-4 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full bg-gradient-to-r ${getProgressGradient()} shadow-lg`}
              />
            </div>

            <AnimatePresence mode="wait">
              {milestoneMessage && (
                <motion.div
                  key={milestoneMessage}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="text-center mb-4"
                >
                  <span className="inline-block px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-bold rounded-full shadow-lg">
                    {milestoneMessage}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-center mb-2">
              <span className="text-sm font-semibold text-gray-400">
                Question {currentQuestion + 1} of {totalQuestions}
              </span>
            </div>

            <p className="text-center text-sm text-gray-400 mb-6">
              {getSubtitle()}
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-3xl font-bold text-white mb-8 text-center leading-tight">
                {getQuestionText(question)}
              </h2>

              {question.type === 'text' && (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && canProceed() && handleNext()}
                    placeholder={question.placeholder}
                    autoFocus
                    className="w-full px-6 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-lg transition-all"
                  />
                </div>
              )}

              {question.type === 'choice' && (
                <div className="grid grid-cols-1 gap-4">
                  {question.options?.map((option) => (
                    <button
                      key={option.text}
                      onClick={() => handleOptionSelect(option.text)}
                      className={`p-5 rounded-xl border-2 transition-all duration-200 text-left font-semibold text-lg ${
                        selectedOptions.includes(option.text)
                          ? 'bg-gradient-to-r from-rose-500 to-pink-500 border-rose-400 text-white shadow-lg transform scale-[1.02]'
                          : 'bg-gray-700/30 border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          selectedOptions.includes(option.text)
                            ? 'bg-white border-white'
                            : 'border-gray-500'
                        }`}>
                          {selectedOptions.includes(option.text) && (
                            <Check className="w-4 h-4 text-rose-500" strokeWidth={3} />
                          )}
                        </div>
                        <span>{option.text}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {question.type === 'multi-choice' && (
                <div>
                  <p className="text-sm text-gray-400 mb-4 text-center">
                    {question.maxSelections && `Select up to ${question.maxSelections} options`}
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {question.options?.map((option) => (
                      <button
                        key={option.text}
                        onClick={() => handleOptionSelect(option.text)}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 text-left font-semibold ${
                          selectedOptions.includes(option.text)
                            ? 'bg-gradient-to-r from-rose-500 to-pink-500 border-rose-400 text-white shadow-lg'
                            : 'bg-gray-700/30 border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                            selectedOptions.includes(option.text)
                              ? 'bg-white border-white'
                              : 'border-gray-500'
                          }`}>
                            {selectedOptions.includes(option.text) && (
                              <Check className="w-4 h-4 text-rose-500" strokeWidth={3} />
                            )}
                          </div>
                          <span>{option.text}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <motion.button
            whileHover={canProceed() ? { scale: 1.02 } : {}}
            whileTap={canProceed() ? { scale: 0.98 } : {}}
            onClick={handleNext}
            disabled={!canProceed()}
            className={`w-full mt-8 py-4 rounded-xl font-bold text-lg shadow-xl transition-all duration-200 ${
              canProceed()
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white cursor-pointer'
                : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
            }`}
          >
            {currentQuestion === QUESTIONS.length - 1 ? 'Create Companion' : 'Continue'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
