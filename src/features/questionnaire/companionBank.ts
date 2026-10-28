import type { Question, QuestionnaireDefinition } from './types';
import { tpl } from './pronouns';
import type { QuestionContext } from './types';

/**
 * Dez's remarks: a few lines per answer to pick from at random (so a second run does not read the same), with the
 * companion's pronouns filled in. He is a country feller, funny and plain-spoken, who says "y'all" and drops the odd g the
 * way he does in the life sim (content/lines.ts), without laying the accent on thick. The shell only
 * has him say one on a couple of the questions each time.
 */
const remarks = (lines: Record<string, string[]>) =>
  (answer: string | string[], ctx: QuestionContext): string[] | null => {
    const key = Array.isArray(answer) ? answer[0] : answer;
    const pool = lines[key];
    return pool ? pool.map(l => tpl(l, ctx)) : null;
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
      reaction: remarks({
        Female: ["A lady, huh. I know a few worth meetin'.", "Female it is. I've met some fine ones 'round here.", "A woman. Smartest call you'll make all day."],
        Male: ["A fella, then. I know a few. Some even wipe their boots.", "Male it is. Know a good one who owes me a favor.", "A man, then. Let me see who still has his manners."],
      }),
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
      reaction: remarks({
        friend: ["A friend. Best kind of trouble.", "Friends first. Y'all start there, the rest follows.", "Just a friend. No shame in it, I've got about four."],
        romantic: ["Something more. Well now, y'all are gettin' somewhere.", "Romance. I'll try to look away.", "Something more, huh. I'll pretend I didn't hear that."],
      }),
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
        'Life of the party': ["Hoo, {she}'s the loud one. I can hear {her} from the next county, I swear.", "Life of the party. {She}'ll have the whole block dancing.", "Big energy. Better stretch first."],
        'Somewhere in between': ["Could go either way, depending on the day. Smart.", "In between. Like a good porch swing.", "A little of both. Hard to bore a person like that."],
        'In her own world': ["The quiet type. Bet {she}'s thinking something good.", "Keeps to {herself}. Still waters, as they say.", "Own world. Nice place, I hear. Good weather."],
        'In his own world': ["The quiet type. Bet {she}'s thinking something good.", "Keeps to {herself}. Still waters, as they say.", "Own world. Nice place, I hear. Good weather."],
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
        if (picks.length > 1) return ["A mix. That's how real folks are, y'all.", "Little of this, little of that. Like a good stew.", "Can't be boxed in. Good."].map(l => tpl(l, ctx));
        return remarks({
          witty: ["Sharp as a tack. Hope y'all had your coffee.", "A wit. You'll need to keep up.", "Quick tongue. I'll watch my back."],
          goofy: ["A clown. I respect that.", "Goofy. Best company there is, and the worst at funerals.", "Silly. I like {her} already."],
          dry: ["Deadpan. Takes you a second, then you're gone.", "Dry as a creek in August. Love it.", "Says it with a straight face. Hard to beat."],
          warm: ["Kind humor. Rare as hen's teeth.", "Makes a joke and a casserole. Warm one.", "Gentle laughs. Easy to be around."],
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
        'Very Direct & Straightforward': ["A straight shooter. Y'all always know where you stand.", "Says it plain. Stings a minute, helps for years.", "No sugar on it. Fine by me."],
        'Diplomatic & Tactful': ["Tactful but honest. Hardest kind to be.", "Tells the truth with a soft landing. Takes skill.", "Honest, but kind about it. I'll take two."],
        'Playfully Indirect': ["Hints and teasing. You'll be guessing, and loving it.", "Plays it sideways. You'll never be bored.", "Says it with a wink. Keeps a fella on his toes."],
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
        'Private & Guarded': ["Hard to crack. Worth the effort, though.", "Keeps {their} cards close. Smart, and a little stubborn.", "Takes time. Good things usually do."],
        'Opens Up Over Time': ["{She}'ll open up in {their} own time. Can't rush that.", "Slow to open, then all in. I like that.", "Gets there when {she}'s ready. Like a good biscuit."],
        'Open Book': ["Wears {their} heart on {their} sleeve. Takes nerve.", "Tells you everything. Hope y'all got time.", "Open book. No guessing, no games."],
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
        'Offers Solutions & Helps You Fix It': ["A fixer. Sleeves up first, questions after.", "Grabs a wrench 'fore you finish the sentence. I know the type.", "Tries to solve it. Might even fix the dang sink."],
        'Listens First, Then Helps': ["Listens first, then helps. That's the right order.", "Hears you out, then pitches in. Wise.", "Ears first, hands second. Good system."],
        'Just Listens & Validates': ["Just stays with you. Sometimes that's all anybody needs.", "Sits with you. No fixing. Rare gift.", "A good listener. Worth more than gold."],
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
        bold: ["Bold. No guesswork there.", "Says it right out. Saves everybody time.", "Forward. I'd blush, but I'm old."],
        sweet: ["Sweet and subtle. It's the little things.", "Saves you the last biscuit. That's love.", "Quiet little kindnesses. Gets me every time."],
        banter: ["Banter. Flirting with a sharp edge.", "Teases you into liking {her}. Clever.", "Trades jabs like love letters."],
        deep: ["Quiet and deep. Notices everything.", "Says little, means all of it.", "Still, but watching. Careful with that one."],
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
      reaction: () => ["Good taste. Never a shortage to talk about.", "That'll keep a conversation goin' all winter, y'all.", "Plenty to talk about. Dinner'll run long."],
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
      reaction: (answer, ctx) => (typeof answer === 'string' && answer
        ? [`${answer}. That suits {her}. Let me go fetch {her}. Get 'er done!`, `${answer}, huh. I like it. One minute.`, `${answer}. Say it enough and it sticks. Hold tight.`].map(l => tpl(l, ctx))
        : null),
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
      question: "Well hey there, y'all! You know me: Dez, mayor of Town, and I drive the delivery truck. Turns out I'm also the matchmaker. Let's find you somebody.",
      autoAdvance: true,
      options: [{ text: "Let's get 'er done", value: 'ready' }],
    },
    { ...byId('relationshipType'), chapter: 'start' },
    { ...byId('connectionType'), chapter: 'start', skipIf: (ctx) => ctx.answers.kindPreset === '1' } as Question,
    {
      id: 'path',
      archetype: 'tap',
      chapter: 'start',
      question: (ctx) => `Do you want to build your ${ctx.subject === 'friend' ? 'friend' : 'companion'}, or be surprised?`,
      reaction: remarks({
        own: ["A builder. I like a person who reads the manual. Let's get 'er done.", "Doing it yourself. Good. I don't trust folks who don't.", "Custom job, then. Wipe your hands, we're going in."],
        random: ["Feelin' lucky. Hold onto your hat, y'all.", "Surprise it is. I once got a surprise goat. This'll be better.", "Leave it to me, then. What could go wrong."],
      }),
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
