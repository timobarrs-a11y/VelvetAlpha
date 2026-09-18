import type { Question, QuestionnaireDefinition } from './types';

export const PERSONAL_QUESTIONNAIRE: QuestionnaireDefinition = {
  startProgress: 20,
  chapters: [
    { id: 'identity', label: 'Who you are', questionIds: ['name', 'birthday', 'favoriteColor', 'beat1'] },
    { id: 'taste', label: 'Your taste', questionIds: ['gender', 'hobbies', 'musicGenre'] },
    { id: 'signals', label: 'Your vibe', questionIds: ['tasteDeck', 'beat2'] },
  ],
  questions: [
    {
      id: 'name',
      archetype: 'tap',
      chapter: 'identity',
      question: 'First things first -- what should I call you?',
      confidence: 'confirmed',
      placeholder: 'Enter your name',
    },
    {
      id: 'birthday',
      archetype: 'tap',
      chapter: 'identity',
      question: (ctx) => {
        const name = ctx.userName;
        return name ? `Hey ${name}! When were you born?` : 'When were you born?';
      },
      confidence: 'confirmed',
      placeholder: 'Select your birthday',
    },
    {
      id: 'favoriteColor',
      archetype: 'grid',
      chapter: 'identity',
      question: "What's your favorite color?",
      confidence: 'tapped',
      columns: 4,
      options: [
        { label: 'Red', value: 'Red', color: '#ef4444' },
        { label: 'Pink', value: 'Pink', color: '#ec4899' },
        { label: 'Orange', value: 'Orange', color: '#f97316' },
        { label: 'Yellow', value: 'Yellow', color: '#eab308' },
        { label: 'Green', value: 'Green', color: '#22c55e' },
        { label: 'Teal', value: 'Teal', color: '#14b8a6' },
        { label: 'Cyan', value: 'Cyan', color: '#06b6d4' },
        { label: 'Blue', value: 'Blue', color: '#3b82f6' },
        { label: 'Purple', value: 'Purple', color: '#8b5cf6' },
        { label: 'Magenta', value: 'Magenta', color: '#d946ef' },
        { label: 'White', value: 'White', color: '#f8fafc' },
        { label: 'Black', value: 'Black', color: '#1e293b' },
      ],
    },
    {
      id: 'beat1',
      archetype: 'beat',
      chapter: 'identity',
      beat: {
        template: (ctx) => {
          const name = ctx.answers.name as string;
          const color = ctx.answers.favoriteColor as string;
          if (name && color) return `${name}. A ${color} person. Got it.`;
          if (name) return `${name}. Noted.`;
          return 'Got it.';
        },
        durationMs: 1500,
      },
    },
    {
      id: 'gender',
      archetype: 'tap',
      chapter: 'taste',
      question: 'How do you identify?',
      confidence: 'confirmed',
      autoAdvance: true,
      options: [
        { text: 'Male', value: 'Male' },
        { text: 'Female', value: 'Female' },
        { text: 'Non-binary', value: 'Non-binary' },
        { text: 'Prefer not to say', value: 'unspecified' },
      ],
    },
    {
      id: 'hobbies',
      archetype: 'grid',
      chapter: 'taste',
      question: 'What are your favorite hobbies?',
      confidence: 'tapped',
      multiSelect: true,
      minSelections: 3,
      allowCustom: true,
      columns: 3,
      options: [
        { label: 'Reading', value: 'Reading', icon: 'BookOpen' },
        { label: 'Gaming', value: 'Gaming', icon: 'Gamepad2' },
        { label: 'Cooking', value: 'Cooking', icon: 'Utensils' },
        { label: 'Hiking', value: 'Hiking', icon: 'MapPin' },
        { label: 'Photography', value: 'Photography', icon: 'Camera' },
        { label: 'Drawing', value: 'Drawing/Painting', icon: 'Palette' },
        { label: 'Writing', value: 'Writing', icon: 'PenTool' },
        { label: 'Music', value: 'Music (Playing/Listening)', icon: 'Music' },
        { label: 'Movies & TV', value: 'Movies/TV Shows', icon: 'Film' },
        { label: 'Fitness', value: 'Fitness/Working Out', icon: 'Dumbbell' },
        { label: 'Yoga', value: 'Yoga/Meditation', icon: 'Heart' },
        { label: 'Dancing', value: 'Dancing', icon: 'Music' },
        { label: 'Gardening', value: 'Gardening', icon: 'Sprout' },
        { label: 'DIY & Crafts', value: 'DIY/Crafts', icon: 'Wrench' },
        { label: 'Travel', value: 'Travel/Exploring', icon: 'Compass' },
        { label: 'Fashion', value: 'Fashion/Shopping', icon: 'ShoppingBag' },
        { label: 'Tech', value: 'Tech/Gadgets', icon: 'Cpu' },
        { label: 'Board Games', value: 'Board Games/Puzzles', icon: 'Puzzle' },
      ],
    },
    {
      id: 'musicGenre',
      archetype: 'grid',
      chapter: 'taste',
      question: "What's your music vibe?",
      confidence: 'tapped',
      multiSelect: true,
      minSelections: 1,
      allowCustom: true,
      columns: 3,
      options: [
        { label: 'R&B / Soul', value: 'R&B/Soul', icon: 'Music' },
        { label: 'Hip-Hop', value: 'Hip-Hop/Rap', icon: 'Music' },
        { label: 'Pop', value: 'Pop', icon: 'Music' },
        { label: 'Rock', value: 'Rock/Alternative', icon: 'Music' },
        { label: 'Lo-fi', value: 'Lo-fi/Chill', icon: 'Music' },
        { label: 'Country', value: 'Country', icon: 'Music' },
        { label: 'Jazz', value: 'Jazz', icon: 'Music' },
        { label: 'Classical', value: 'Classical', icon: 'Music' },
        { label: 'EDM', value: 'Electronic/EDM', icon: 'Music' },
        { label: 'Reggae', value: 'Reggae/Dancehall', icon: 'Music' },
        { label: 'Latin', value: 'Latin', icon: 'Music' },
        { label: 'A bit of everything', value: 'A Little Bit Of Everything', icon: 'Music' },
      ],
    },
    {
      id: 'tasteDeck',
      archetype: 'swipe',
      chapter: 'signals',
      question: 'Quick round -- just tell me what sounds better.',
      confidence: 'play',
      cards: [
        {
          prompt: 'Late night gaming session',
          left: { label: 'Gaming night', icon: 'Gamepad2' },
          right: { label: 'Sunrise hike', icon: 'Sunrise' },
        },
        {
          prompt: 'Home-cooked dinner',
          left: { label: 'Cook at home', icon: 'Utensils' },
          right: { label: 'Try a new restaurant', icon: 'MapPin' },
        },
        {
          prompt: 'Weekend plan',
          left: { label: 'Road trip', icon: 'Car' },
          right: { label: 'Stay in & recharge', icon: 'Home' },
        },
        {
          prompt: 'How you watch sports',
          left: { label: 'Live at the game', icon: 'Trophy' },
          right: { label: 'On the couch', icon: 'Tv' },
        },
        {
          prompt: 'Night out',
          left: { label: 'Dive bar', icon: 'Wine' },
          right: { label: 'Rooftop spot', icon: 'Building' },
        },
        {
          prompt: 'Morning routine',
          left: { label: 'Gym at 6am', icon: 'Dumbbell' },
          right: { label: 'Sleep in', icon: 'Moon' },
        },
      ],
    },
    {
      id: 'beat2',
      archetype: 'beat',
      chapter: 'signals',
      beat: {
        template: (ctx) => {
          const name = ctx.answers.name as string;
          return name ? `That's a lot to work with, ${name}.` : "That's a lot to work with.";
        },
        durationMs: 1500,
      },
    },
  ],
};
