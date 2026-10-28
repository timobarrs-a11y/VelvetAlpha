import type { Question, QuestionnaireDefinition } from './types';
import { tpl } from './pronouns';
import type { QuestionContext } from './types';

/** Dez's remark for a pick: a line per answer (the same for everybody), with the companion's pronouns filled in. */
const remarks = (lines: Record<string, string>) =>
  (answer: string | string[], ctx: QuestionContext): string | null => {
    const key = Array.isArray(answer) ? answer[0] : answer;
    const line = lines[key];
    return line ? tpl(line, ctx) : null;
  };

export const COMPANION_QUESTIONNAIRE: QuestionnaireDefinition = {
  startProgress: 20,
  chapters: [
    { id: 'connection', label: 'How you connect', questionIds: ['relationshipType', 'connectionType'] },
    { id: 'energy', label: 'Who {she} is', questionIds: ['energy', 'humor'] },
    { id: 'treats', label: 'How {she} treats you', questionIds: ['directness', 'openness', 'care'] },
    { id: 'warmth', label: 'How {she} loves', questionIds: ['warmth', 'interests'] },
    // Six dials, each one thing the companion visibly does differently (docs/onboarding/voice-audit.md): energy,
    // humor, how straight {she} is, how open, fix-or-listen, and (companions only) how bold. Everything else a person
    // could be asked is learned in conversation: love language and "when it's hard" in the first week
    // (supabase/functions/_shared/companionWeekOne.ts).
    { id: 'depth', label: 'The bond', questionIds: ['companionName'] },
  ],
  questions: [
    {
      id: 'relationshipType',
      archetype: 'tap',
      chapter: 'connection',
      question: 'Who are you looking for?',
      reaction: remarks({ Female: "A woman, then. I know a few worth meeting.", Male: "A fella, then. I know a few of those too." }),
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
      reaction: remarks({ friend: "A friend first. Best way to start anything.", romantic: "Something more. Now we're talking." }),
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
      question: (ctx) => tpl(`Picture {her} walking into a party. Does {she} work the room, or find the quiet corner?`, ctx),
      reaction: remarks({
        'Life of the party': "Hoo, {she}'s the loud one. No dull nights with {her}.",
        'Somewhere in between': "Could go either way, depending on the day. Smart.",
        'In her own world': "The quiet type. Bet {she}'s thinking about something good.",
        'In his own world': "The quiet type. Bet {she}'s thinking about something good.",
      }),
      confidence: 'tapped',
      config: {
        min: 0,
        max: 2,
        step: 1,
        default: 1,
        leftLabel: 'Life of the party',
        rightLabel: 'In {their} own world',
        valueLabels: [
          'Life of the party',
          'Somewhere in between',
          'In {their} own world',
        ],
      },
    },
    {
      id: 'humor',
      archetype: 'preview',
      chapter: 'energy',
      question: (ctx) => tpl(`You burn the toast and set off the smoke alarm. What does {she} say?`, ctx),
      reaction: (answer, ctx) => {
        const picks = Array.isArray(answer) ? answer : [answer];
        if (picks.length > 1) return tpl("A mix. That's how real folks are.", ctx);
        return remarks({
          witty: "Sharp. Hope you've had your coffee.",
          goofy: "A clown. I respect that.",
          dry: "Deadpan. Takes you a second, then you're gone.",
          warm: "Kind humor. Rare as hen's teeth.",
        })(picks[0], ctx);
      },
      confidence: 'tapped',
      pickUpTo: 2,
      pickHint: 'Pick the one that sounds most like them. Add a second if they are a mix.',
      bubbles: [
        { voice: 'Witty', value: 'witty', messages: ["Impressive. You've turned breakfast into a fire drill."] },
        { voice: 'Goofy', value: 'goofy', messages: ['BREAKING NEWS: toast escapes, alarm sounds the alert 🚨🍞'] },
        { voice: 'Dry', value: 'dry', messages: ["Crispy. Just how the smoke detector likes it."] },
        { voice: 'Warm', value: 'warm', messages: ["Aw, come here, it's just toast. I'll open a window, you make more."] },
      ],
    },
    {
      id: 'directness',
      archetype: 'scrub',
      chapter: 'treats',
      question: (ctx) => tpl(`You ask {her} how the new haircut looks, and it is not great. What happens?`, ctx),
      reaction: remarks({
        'Very Direct & Straightforward': "A straight shooter. You'll always know where you stand.",
        'Diplomatic & Tactful': "Tactful but honest. The hardest kind to be.",
        'Playfully Indirect': "Hints and teasing. You'll be guessing, and loving it.",
      }),
      confidence: 'tapped',
      config: {
        min: 0, max: 2, step: 1, default: 1,
        leftLabel: 'Tells you straight',
        rightLabel: 'Hints and teases',
        valueLabels: ['Tells you straight', 'Tactful, but honest', 'Hints and teases'],
        values: ['Very Direct & Straightforward', 'Diplomatic & Tactful', 'Playfully Indirect'],
      },
    },
    {
      id: 'openness',
      archetype: 'scrub',
      chapter: 'treats',
      question: (ctx) => tpl(`{She} has had a rough week. Does {she} tell you about it?`, ctx),
      reaction: remarks({
        'Private & Guarded': "Hard to crack. Worth the effort, though.",
        'Opens Up Over Time': "{She}'ll open up in {their} own time. Can't rush that.",
        'Open Book': "Wears {their} heart on {their} sleeve. That takes nerve.",
      }),
      confidence: 'tapped',
      config: {
        min: 0, max: 2, step: 1, default: 1,
        leftLabel: 'Keeps it to {herself}',
        rightLabel: 'Tells you everything',
        valueLabels: ['Keeps it to {herself}', "Opens up when {she}'s ready", 'Tells you everything'],
        values: ['Private & Guarded', 'Opens Up Over Time', 'Open Book'],
      },
    },
    {
      id: 'care',
      archetype: 'scrub',
      chapter: 'treats',
      question: (ctx) => tpl(`You come home wrecked after a bad day. What does {she} do?`, ctx),
      reaction: remarks({
        'Offers Solutions & Helps You Fix It': "A fixer. Sleeves up first, questions after.",
        'Listens First, Then Helps': "Listens first, then helps. That's the order that works.",
        'Just Listens & Validates': "Just stays with you. Sometimes that's all anybody needs.",
      }),
      confidence: 'tapped',
      config: {
        min: 0, max: 2, step: 1, default: 1,
        leftLabel: 'Rolls up {their} sleeves',
        rightLabel: 'Just stays with you',
        valueLabels: ['Fixes it with you', 'Listens first, then helps', 'Just listens'],
        values: ['Offers Solutions & Helps You Fix It', 'Listens First, Then Helps', 'Just Listens & Validates'],
      },
    },
    {
      id: 'warmth',
      archetype: 'preview',
      chapter: 'warmth',
      // Friends do not flirt: this is the one question only a companion is asked.
      skipIf: (ctx) => ctx.subject === 'friend' || ctx.answers.connectionType === 'friend',
      question: (ctx) => tpl(`Now the fun part. How does {she} let you know {she}'s into you?`, ctx),
      reaction: remarks({
        bold: "Bold. No guesswork there.",
        sweet: "Sweet and subtle. It's the little things.",
        banter: "Banter. Flirting with a sharp edge.",
        deep: "Quiet and deep. Notices everything.",
      }),
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
      question: (ctx) => tpl(`What is {she} into? Pick a few.`, ctx),
      reaction: () => "Good taste. Never a shortage to talk about.",
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
      reaction: (answer, ctx) => (typeof answer === 'string' && answer ? tpl(`${answer}. That suits {her}. Let me go and fetch {her}.`, ctx) : null),
      confidence: 'confirmed',
      placeholder: 'Type a name...',
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
      reaction: remarks({ own: "A builder. I like it. Let's make {her} just right.", random: "Feeling lucky. Hold onto your hat." }),
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
