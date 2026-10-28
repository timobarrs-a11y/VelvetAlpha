import type { Question, QuestionnaireDefinition } from './types';
import { tpl } from './pronouns';
import type { QuestionContext } from './types';

export const COMPANION_QUESTIONNAIRE: QuestionnaireDefinition = {
  startProgress: 20,
  chapters: [
    { id: 'connection', label: 'How you connect', questionIds: ['relationshipType', 'connectionType'] },
    { id: 'energy', label: 'Who {she} is', questionIds: ['energy', 'beat1'] },
    { id: 'warmth', label: 'How {she} loves', questionIds: ['warmth', 'interests'] },
    // How {she} texts (direct, playful, gentle...) is not asked: it follows from how {she} shows {she} cares, and the
    // signature voice page that comes after covers the rest. Love language and "when it's hard" are asked by the companion in its first week
    // (supabase/functions/_shared/companionWeekOne.ts), not here.
    { id: 'depth', label: 'The bond', questionIds: ['companionName', 'beat2'] },
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
      question: (ctx) => tpl(`Picture your ideal person. Is {she} the life of the party, or in {hers} own world?`, ctx),
      confidence: 'tapped',
      config: {
        min: 0,
        max: 2,
        step: 1,
        default: 1,
        leftLabel: 'Life of the party',
        rightLabel: 'In {hers} own world',
        valueLabels: [
          'Life of the party',
          'Somewhere in between',
          'In {hers} own world',
        ],
      },
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

/**
 * The first screens of making someone, in the same shell as the rest: who (gender), what kind (friend or companion,
 * skipped when it was already chosen on the way in), and how (build them yourself or be surprised). Gender comes
 * first on purpose. Build-your-own continues in COMPANION_QUESTIONNAIRE without these three; surprise-me makes
 * everything else at random and never shows it.
 */
const byId = (id: string) => COMPANION_QUESTIONNAIRE.questions.find(q => q.id === id)!;

export const COMPANION_START: QuestionnaireDefinition = {
  startProgress: 0,
  chapters: [{ id: 'start', label: 'Who you are looking for', questionIds: ['dezIntro', 'relationshipType', 'connectionType', 'path'] }],
  questions: [
    {
      // Dez says this the same way to everyone. By now the person knows him from the arrival questions and the town.
      id: 'dezIntro',
      archetype: 'tap',
      chapter: 'start',
      question: "Well, hey there. You know me: Dez, mayor of Town, and I drive the delivery truck. Turns out I'm also the matchmaker. Let's find you somebody.",
      autoAdvance: true,
      options: [{ text: "Let's do it", value: 'ready' }],
    },
    { ...byId('relationshipType'), chapter: 'start' },
    { ...byId('connectionType'), chapter: 'start', skipIf: (ctx) => ctx.answers.kindPreset === '1' } as Question,
    {
      id: 'path',
      archetype: 'tap',
      chapter: 'start',
      question: (ctx) => `Do you want to build your ${ctx.subject === 'friend' ? 'friend' : 'companion'}, or be surprised?`,
      confidence: 'tapped',
      autoAdvance: true,
      options: [
        { text: 'Build them myself', value: 'own' },
        { text: 'Surprise me', value: 'random' },
      ],
    },
  ],
};

export function resolveQuestionText(q: Question, ctx: QuestionContext): string {
  if (typeof q.question === 'function') return q.question(ctx);
  return tpl(q.question ?? '', ctx);
}
