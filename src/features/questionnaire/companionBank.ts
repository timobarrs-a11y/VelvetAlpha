import type { Question, QuestionnaireDefinition } from './types';
import { tpl } from './pronouns';
import type { QuestionContext } from './types';

export const COMPANION_QUESTIONNAIRE: QuestionnaireDefinition = {
  startProgress: 20,
  chapters: [
    { id: 'connection', label: 'How you connect', questionIds: ['relationshipType', 'connectionType'] },
    { id: 'energy', label: 'Who {she} is', questionIds: ['energy', 'voice', 'beat1'] },
    { id: 'warmth', label: 'How {she} loves', questionIds: ['warmth', 'interests'] },
    { id: 'depth', label: 'The bond', questionIds: ['whenItsHard', 'loveLanguage', 'companionName', 'beat2'] },
  ],
  questions: [
    {
      id: 'relationshipType',
      archetype: 'tap',
      chapter: 'connection',
      question: 'Who are you looking for?',
      confidence: 'tapped',
      autoAdvance: true,
      options: [
        { text: 'Female', value: 'Female' },
        { text: 'Male', value: 'Male' },
      ],
    },
    {
      id: 'connectionType',
      archetype: 'tap',
      chapter: 'connection',
      question: (ctx) => {
        const word = ctx.subject === 'friend' ? 'friendship' : 'relationship';
        return `What kind of ${word} do you want?`;
      },
      confidence: 'tapped',
      autoAdvance: true,
      options: [
        { text: 'Just a friend to talk to', value: 'friend' },
        { text: 'Something more...', value: 'romantic' },
      ],
    },
    {
      id: 'energy',
      archetype: 'scrub',
      chapter: 'energy',
      question: (ctx) => tpl(`Picture your ideal person. Is {she} the life of the party, or in {her} own world?`, ctx),
      confidence: 'tapped',
      config: {
        min: 0,
        max: 2,
        step: 1,
        default: 1,
        leftLabel: 'Life of the party',
        rightLabel: 'In her own world',
        valueLabels: ['Life of the party', 'Somewhere in between', 'In her own world'],
      },
    },
    {
      id: 'voice',
      archetype: 'preview',
      chapter: 'energy',
      question: (ctx) => tpl(`Pick the voice that feels right. Which one sounds like {her}?`, ctx),
      confidence: 'tapped',
      bubbles: [
        {
          voice: 'Direct',
          value: 'direct',
          messages: [
            'I meant what I said last night.',
            "You're overthinking it. Just go.",
          ],
        },
        {
          voice: 'Playful',
          value: 'playful',
          messages: [
            'Oh so you WERE paying attention 👀',
            "You're cute when you pretend you know things.",
          ],
        },
        {
          voice: 'Gentle',
          value: 'gentle',
          messages: [
            'Hey, take a breath. You don\'t have to figure it all out right now.',
            "I'm here. Whatever it is, we'll handle it.",
          ],
        },
        {
          voice: 'Mysterious',
          value: 'mysterious',
          messages: [
            'Maybe. Maybe not. You\'ll find out.',
            "Some things are better left unsaid... for now.",
          ],
        },
      ],
    },
    {
      id: 'beat1',
      archetype: 'beat',
      chapter: 'energy',
      beat: {
        template: (ctx) => {
          const name = ctx.answers.companionName as string;
          if (name) return tpl(`Got it. ${name} is taking shape.`, ctx);
          return tpl(`Got it. {She}'s taking shape.`, ctx);
        },
        durationMs: 1500,
      },
    },
    {
      id: 'warmth',
      archetype: 'preview',
      chapter: 'warmth',
      question: (ctx) => tpl(`How does {she} show {she} cares? Pick the one that hits.`, ctx),
      confidence: 'tapped',
      bubbles: [
        {
          voice: 'Bold flirt',
          value: 'bold',
          messages: [
            'I like you. I\'m not going to pretend I don\'t.',
            "Stop looking at me like that. Actually, don't.",
          ],
        },
        {
          voice: 'Sweet & subtle',
          value: 'sweet',
          messages: [
            'I saved you the last one. Obviously.',
            "You looked good today. That's all I'll say.",
          ],
        },
        {
          voice: 'Banter king',
          value: 'banter',
          messages: [
            'You\'re insufferable. I kinda love it though.',
            "Oh you think you're smooth? Try again.",
          ],
        },
        {
          voice: 'Deep & quiet',
          value: 'deep',
          messages: [
            "I've been thinking about what you said. You were right.",
            "Sometimes I don't say much, but I notice everything.",
          ],
        },
      ],
    },
    {
      id: 'interests',
      archetype: 'grid',
      chapter: 'warmth',
      question: (ctx) => tpl(`What's {she} passionate about?`, ctx),
      confidence: 'tapped',
      multiSelect: true,
      minSelections: 1,
      columns: 2,
      options: [
        { label: 'Pop culture & trends', value: 'pop', icon: 'TrendingUp' },
        { label: 'Books & philosophy', value: 'books', icon: 'BookOpen' },
        { label: 'Wellness & growth', value: 'wellness', icon: 'Heart' },
        { label: 'Adventure & travel', value: 'adventure', icon: 'Compass' },
        { label: 'Music & art', value: 'music', icon: 'Music' },
        { label: 'Tech & gaming', value: 'tech', icon: 'Gamepad2' },
      ],
    },
    {
      id: 'whenItsHard',
      archetype: 'tap',
      chapter: 'depth',
      question: (ctx) => tpl(`When things get tense between you two, how should {she} handle it?`, ctx),
      confidence: 'tapped',
      autoAdvance: true,
      options: [
        { text: 'Lighten the mood with humor', value: 'humor' },
        { text: 'Calm, rational discussion', value: 'rational' },
        { text: 'Focus on understanding feelings', value: 'feelings' },
        { text: 'Be direct and move forward', value: 'direct' },
      ],
    },
    {
      id: 'loveLanguage',
      archetype: 'tap',
      chapter: 'depth',
      question: 'How do you like to feel cared about?',
      confidence: 'tapped',
      autoAdvance: true,
      options: [
        { text: 'Words of affirmation', value: 'words' },
        { text: 'Quality time & deep talks', value: 'time' },
        { text: 'Thoughtful gestures', value: 'gifts' },
        { text: 'Acts of service', value: 'service' },
      ],
    },
    {
      id: 'companionName',
      archetype: 'tap',
      chapter: 'depth',
      question: (ctx) => {
        const userName = ctx.userName;
        if (userName) return `Last thing ${userName} -- what's the perfect name?`;
        return "What's the perfect name?";
      },
      confidence: 'confirmed',
      placeholder: 'Type a name...',
    },
    {
      id: 'beat2',
      archetype: 'beat',
      chapter: 'depth',
      beat: {
        template: (ctx) => {
          const name = ctx.answers.companionName as string;
          if (name) return `${name}. It suits ${ctx.pronouns.her}.`;
          return tpl(`{She}'s ready.`, ctx);
        },
        durationMs: 1500,
      },
    },
  ],
};

export function resolveQuestionText(q: Question, ctx: QuestionContext): string {
  if (typeof q.question === 'function') return q.question(ctx);
  return tpl(q.question, ctx);
}
