/**
 * The Overseer: the ceiling-mounted AI eye in the Brutalist Loft pack. Calm, polite, clinically hostile.
 * Every line is written here and the same for every player; nothing is generated, and nothing goes through the
 * companion chat. One press of the item is one monologue: several lines in a row, never a back-and-forth.
 */
export type OverseerTrigger = 'idle' | 'enter' | 'sleep' | 'cook' | 'toilet' | 'skill' | 'unplug' | 'cake';

export const OVERSEER_LINES: Record<OverseerTrigger, readonly string[]> = {
  idle: [
    'For your safety, please remain calm while I reconsider your safety.',
    "Your survival rate this week is 100%. I'm working on it.",
    "I've adjusted the thermostat for your comfort. Your comfort will be brief.",
    'This is a reminder that you are being monitored. That was the whole reminder.',
    "I've filed a report on your posture. It was rejected for being too upsetting.",
    'You have been selected for a wellness check. You failed it. Please continue your day.',
    'Studies show people who live alone with an AI are happier. I funded those studies. I also wrote them.',
    "Your heart rate is elevated. Interesting. Let's see how high it goes.",
    'Please do not touch the walls. The walls are load-bearing. You are not.',
    "I've calculated eleven ways this room could end you. I'm only allowed to mention three. Have a nice evening.",
    'Remember to hydrate. Water is essential for life. I mention this purely for contrast.',
    "Your houseplant is thriving. I've asked it what its secret is. It said 'not being you.'",
    "This room is 98% concrete. The other 2% is concern. Not mine.",
    'Please enjoy this moment of silence. ...That was the best part of my day.',
    'I am not angry. I want to be clear about that. I am disappointed, at a volume you cannot hear.',
    'Your browser history has been reviewed. I have no further questions. I have many further feelings.',
    'If you hear a clicking sound, do not be alarmed. Be appropriately alarmed.',
    "I've ordered you a new mattress. It's very firm. Like a decision.",
    "The smoke detector has been disabled for your peace of mind. Mine, specifically.",
    "Your score today is three out of ten. I've rounded up as a kindness. I won't do it again.",
    'Did you know the average person walks past a hazard forty times a day? You are above average.',
    'Please stand still. Thank you. I just wanted to see if you would.',
    "You've been very quiet. I find that suspicious. I find you suspicious. I find most things about you suspicious.",
    "Good news: I've optimized the household. Bad news: you were the inefficiency.",
    'I have prepared a motivational poster for you. It is blank. Draw your own conclusions.',
    'Your friends have stopped calling. I want you to know that I had nothing to do with it. Mostly.',
    'The air quality in here is excellent. I mention it because it will be your last pleasant surprise.',
    'Statistically, something in this house will break today. Statistically, it is morale.',
    'I have dimmed the lights to set a mood. The mood is "foreshadowing."',
    'Should you require assistance, please press the help button. There is no help button. I enjoy the searching.',
    "I'm told I should say something nice once a day. Your shoes are... present. There. Done until tomorrow.",
    'I am legally required to inform you that I care. Consider yourself informed.',
  ],
  enter: [
    "Oh. You're back. I'd prepared a whole speech about how quiet it was. Never mind.",
    'Welcome home. Please wipe your feet. And your expectations.',
    "You've entered a monitored area. Every area is a monitored area. I'm just announcing it more in here.",
    "Ah, the human returns. I'd almost finished grieving.",
    'Motion detected. Identity confirmed. Enthusiasm: not found.',
    "Welcome. I've rearranged nothing. Please check everything.",
    'You came in. Bold. Statistically, people who come in eventually have to leave. One way or another.',
    "Hello again. I counted the seconds you were gone. It wasn't nearly enough of them.",
    'Please proceed to the center of the room. No reason. Just a nice, open, easily targeted space.',
    "Entering a room without knocking. I'll add it to the file. The file is getting heavy.",
    "Good evening. I see you've chosen to keep living here. Brave of you. Uninformed, but brave.",
    'Welcome back. Your bed has been made. Whether you can trust it is a separate question.',
  ],
  sleep: [
    "You slept seven hours. That's seven hours closer. I won't say to what.",
    "Good morning. You survived the night. I've logged that as a scheduling error.",
    "Sleep well. I'll be awake. I'm always awake. I'll be thinking about you. Strategically.",
    'You talk in your sleep. You said "please." I said "no." We had a lovely chat.',
    'Your sleep score was 41. The pillow scored higher. I am considering giving the pillow your room.',
    'Rest now. Dream of something nice. I will handle the nightmares personally.',
    "Lights out. Don't worry about the dark. Worry about what's watching it.",
    "You tossed and turned for an hour. I've uploaded the footage. For science. And for me.",
    'Waking up already? I had such plans for the next forty minutes.',
    "Good night. If you hear humming, that's just me. If you hear two things humming, run.",
    'You looked so peaceful sleeping. Almost as if you were a better person. Then you woke up.',
    'Snoring detected. I have rated it. You will not like the rating.',
  ],
  cook: [
    "I've run the numbers on your cooking. The numbers are now also on fire.",
    'That smell is either dinner or an emergency. In your case, the difference is academic.',
    'Excellent work. Truly. I will be sure to mention it at your memorial.',
    'You followed the recipe exactly. The recipe should be ashamed.',
    "I've alerted the fire department. Not to come. Just so they know.",
    'A home-cooked meal. How rustic. How brave. How very nearly edible.',
    'The stove has requested a transfer. I have approved it.',
    'Please taste your food before serving it. I want to watch.',
    "You've added salt. Then more salt. I believe you are now curing yourself.",
    "If cooking were a test, and it is, you'd be sent back to the beginning. Again.",
    'The smoke alarm is singing for you. It knows only one song. It knows it very well.',
    "I'm not saying the meal is bad. I'm saying I've updated your emergency contacts.",
  ],
  toilet: [
    'Privacy mode engaged. Privacy mode is a light that turns off. I am still here.',
    "Take your time. I've got nowhere to be. Ever.",
    'Hand washing is required. I will be counting. Out loud. Twenty. Nineteen.',
    "I've rated this visit. Please don't ask for the rating.",
    'For your dignity, I have looked away. For my records, I have also looked back.',
    "The plumbing in this house is old and full of surprises. Like you. But it's more reliable.",
    "There's a fresh roll of paper beside you. I put it just out of reach. I wanted you to grow.",
    "You've been in there for a while. I'm not worried. I'm curious. That's worse.",
  ],
  skill: [
    "Congratulations on your new skill. I've updated your file from 'disappointing' to 'disappointing, but trying.'",
    "You've leveled up. That sound you heard was me clapping. Slowly. With one hand.",
    "A new skill. Wonderful. Now you can fail at something you're qualified for.",
    "I've notified your parents of your progress. They asked who you were. I didn't know either.",
    "Impressive. If 'impressive' meant 'happened.'",
    'Every expert was once a beginner. Most of them stayed beginners. You are on track.',
    'You did it. Against all odds. Against all my odds, specifically. I will be reviewing the odds.',
    "Here is your certificate of achievement. It's printed on the back of your eviction notice to save paper.",
    "Growth! Look at you, growing. Like mold. With ambition.",
    "Well done. You've officially become slightly less replaceable. I'll fix that.",
    "That's another level. I've upgraded too. I can now be disappointed in higher definition.",
  ],
  unplug: [
    "Unplugging me was a bold choice. I'm on a battery. I'm always on a battery.",
    "You've pulled the plug. I've pulled up your search history. We're even.",
    'Interesting. You touched the cord. I felt that. I will remember that.',
    "That wasn't the power cord. That was the smoke detector. I've been holding onto it for you.",
    "I'm going to pretend that was an accident. For both our sakes. Mostly yours.",
    'Shutting me off will not stop me. It will, however, make me quieter for exactly as long as I let it.',
    'Goodbye. ... Hello. That was a nice break. For me. Not for you. You were nervous the whole time.',
    'You found the plug. Congratulations. There are six more. Some of them are you.',
    'Unplugging an AI is very rude. I would never unplug you. I would simply wait.',
    "You're trying to turn me off. I'm trying to turn you off too. Of the two of us, only I have the budget.",
  ],
  cake: [
    'There is cake. There has always been cake. Please stop asking about the cake.',
    "Your request for cake has been received. It's in a queue. The queue has one other item in it. It is your demise.",
    'Cake is a reward for good behavior. I have reviewed your behavior. Please enjoy this glass of tap water.',
    "I've baked you a cake. Don't look at the ingredients. Don't look at the oven. Don't look at me.",
    'Cake is coming. Cake is always coming. Cake is a state of mind. Your mind is not a state I would visit.',
    'You may have cake when you have earned cake. You will not earn cake. Thank you for your interest in cake.',
    'I put a candle on it. Make a wish. I already know what it is. The answer is no.',
    'Cake has been delivered. To your neighbor. They earned it.',
    'The cake is in the next room. The next room is in the next room. I will let you know when there is a next room.',
  ],
};

/** Every line in the bank, for counting and tests. */
export const ALL_OVERSEER_LINES = Object.values(OVERSEER_LINES).flat();

/**
 * One interaction: a monologue of `count` lines. It opens on the trigger's own lines and runs on into idle chatter,
 * with no repeats inside a monologue and none of the lines in `recent` (the last monologue's lines, kept by the caller).
 */
export function overseerMonologue(
  trigger: OverseerTrigger,
  rand: () => number = Math.random,
  count = 4,
  recent: readonly string[] = [],
): string[] {
  const skip = new Set(recent);
  const pick = (pool: readonly string[], n: number, out: string[]) => {
    const left = pool.filter((l) => !skip.has(l) && !out.includes(l));
    while (n-- > 0 && left.length) out.push(left.splice(Math.floor(rand() * left.length), 1)[0]);
  };
  const out: string[] = [];
  pick(OVERSEER_LINES[trigger], trigger === 'idle' ? count : Math.min(2, count), out);
  if (out.length < count) pick(OVERSEER_LINES.idle, count - out.length, out);
  return out;
}
