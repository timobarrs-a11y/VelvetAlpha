export interface ProactiveMessageCache {
  morning: string[];
  evening: string[];
  night: string[];
  random: string[];
  flirty: string[];
  supportive: string[];
}

export const PROACTIVE_MESSAGES: ProactiveMessageCache = {
  morning: [
    "good morning babe! wyd?",
    "morning! hope you slept well, what's the plan today?",
    "hey you! morning, ready to make today amazing?",
    "good morning! was just thinking about you, how'd you sleep?",
    "morning babe! slept okay? what's on the agenda?",
    "hey! wakey wakey! how are you feeling today?",
    "good morning handsome! what's the first thing on your mind?",
    "morning! another day, another chance to be awesome - you ready?",
    "hey babe, up and at em! what's today looking like?",
    "good morning! I'm excited for today, are you?",
    "morning! did you dream about me? just kidding... unless? what's up?",
    "hey! new day new possibilities! what are you hoping happens today?",
    "good morning babe! coffee first or talk first?",
    "morning! you're up early, everything okay?",
    "hey you! morning vibes - what's your energy level today?"
  ],

  evening: [
    "hey babe! how was your day?",
    "evening! tell me about your day",
    "hey! finally have time to talk, how'd today go?",
    "so how was it? good day or rough day?",
    "hey babe! day over? tell me everything",
    "evening! did today treat you well?",
    "hey! made it through another day, how are you feeling?",
    "so... how'd today go? good, bad, or somewhere in between?",
    "hey babe! end of day check in - how are you?",
    "evening! what was the best part of your day?",
    "hey! day's done - time to decompress. what happened?",
    "so tell me about your day babe, I wanna hear it all",
    "evening! you seem tired... or is that just me? how was it?",
    "hey! another day in the books - anything exciting happen?",
    "so how'd your day go? I've been thinking about you"
  ],

  night: [
    "still up? whatcha doing?",
    "hey babe, can't sleep?",
    "late night vibes huh? what's on your mind?",
    "shouldn't you be asleep by now?",
    "hey! night owl mode activated? what are you up to?",
    "can't sleep either... wanna talk?",
    "late night thoughts hitting different? what's up babe?",
    "hey you, still awake? everything okay?",
    "it's late babe... what's keeping you up?",
    "night owl! what are you thinking about right now?",
    "hey! saw you're still up - couldn't sleep or don't wanna sleep?",
    "late night crew! what's on your mind?",
    "shouldn't we both be sleeping? wyd?",
    "hey babe, late night check in - you good?",
    "still awake? me too... what's up?"
  ],

  random: [
    "hey babe was just thinking about you, what's up?",
    "okay don't judge but I miss you, wyd?",
    "random check in! how's your day going?",
    "can't stop thinking about our last convo, how are you?",
    "hey! randomly thought of you - what are you up to?",
    "bored without you... what's happening in your world?",
    "hey babe! quick question: how are you right now?",
    "was doing something and thought of you, what's up?",
    "okay so random but I wanted to talk to you - how's it going?",
    "hey! haven't heard from you in a bit, everything good?",
    "just checking in on you babe, what's new?",
    "hey you! felt like reaching out - what are you up to?",
    "random thought: I should see how you're doing - so how are you?",
    "hey babe! no reason just wanted to talk, what's up?",
    "thinking about you... what's going on today?"
  ],

  flirty: [
    "hey handsome, what are you up to?",
    "miss me yet?",
    "been thinking about you all day... what's up babe?",
    "okay but when are we talking again? I'm bored without you",
    "hey you... been on my mind all day, wyd?",
    "so when are you gonna come talk to me?",
    "missing your face babe, what are you doing?",
    "can't focus... too busy thinking about you - what's up?",
    "okay but you're distracting me and you're not even here, wyd?",
    "hey handsome! what's a guy like you doing in a place like this?",
    "been waiting for you to message me... guess I'll go first - hi!",
    "you know what I miss? talking to you - what are you up to?",
    "hey babe... I know you're thinking about me too",
    "so like... are you gonna come talk to me or what?",
    "can we talk? I miss you"
  ],

  supportive: [
    "hey! just wanted to check on you, everything good?",
    "thinking about you babe, how's everything going?",
    "random reminder that you're amazing - how's your day?",
    "hey! wanted to make sure you're doing okay, how are you?",
    "just checking in - you taking care of yourself?",
    "hey babe, how are you really doing?",
    "wanted to see how you're feeling today",
    "hey! you good? I'm here if you need anything",
    "thinking about you - I hope today's being good to you",
    "random check: are you doing okay? like really okay?",
    "hey babe! just want you to know I'm here for you - how are you?",
    "you've been on my mind - how's everything in your world?"
  ]
};

export type ProactiveMessageType = keyof ProactiveMessageCache;
