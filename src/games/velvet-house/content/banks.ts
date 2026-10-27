import type { LineBank } from '../script/types';

/**
 * Lines that depend on how the companion talks, keyed by what the player picked when making them. A script asks for a
 * bank and a slot (`{ bank: 'humor', slot: 'couchCarried' }`) and gets the line for this companion's humor, or
 * communication style. Slots are situations, not wording, so the same slot can be written for every style.
 *
 * Humor styles:         witty (Witty & Clever) · goofy (Goofy & Random) · dry (Sarcastic & Dry) · warm (Warm & Light)
 * Communication styles: direct · diplomatic (Diplomatic & Tactful) · playful (Playfully Indirect) · subtle (Subtle & Suggestive)
 * Lines are written to work for a partner or a roommate, with no pet names.
 */
export const HUMOR_KEYS = ['witty', 'goofy', 'dry', 'warm'] as const;
export const COMM_KEYS = ['direct', 'diplomatic', 'playful', 'subtle'] as const;
export type HumorKey = (typeof HUMOR_KEYS)[number];
export type CommKey = (typeof COMM_KEYS)[number];

/** What the app stores ("Sarcastic & Dry") as the key the banks use. */
export function humorKey(raw: unknown): HumorKey {
  const s = typeof raw === 'string' ? raw.toLowerCase() : '';
  return s.includes('witty') ? 'witty' : s.includes('goofy') ? 'goofy' : s.includes('sarcas') || s.includes('dry') ? 'dry' : 'warm';
}
export function commKey(raw: unknown): CommKey {
  const s = typeof raw === 'string' ? raw.toLowerCase() : '';
  return s.includes('direct') && !s.includes('indirect') ? 'direct' : s.includes('playful') ? 'playful' : s.includes('subtle') ? 'subtle' : 'diplomatic';
}

export const BANKS: LineBank = {
  humor: {
    witty: {
      truckOffRoad: 'Bold parking, Dez. Is the curb optional in {town}, or just the road?',
      couchCarried: 'The mayor of {town} is hauling our couch personally. I feel like we owe him a vote.',
      keepIt: "TV wall it is. Bold choice. I'll be over here, quietly right about the window.",
      movedIt: 'Light, a couch, and someone with excellent taste. Okay, two out of three.',
      fridgeEmpty: "The fridge contains one ice tray and a lot of potential. Let's order something.",
      lampByCouch: 'On second thought, the lamp belongs next to the couch. Reading light is a basic human right.',
      lampOn: "And there's the light. Look at the couch glow. I'd like to formally thank the lamp.",
    },
    goofy: {
      truckOffRoad: 'Did anyone else see the truck go full off-road? Because I did, and I want a ride.',
      couchCarried: 'THE MAYOR. IS CARRYING. OUR COUCH. Somebody put this on a postage stamp.',
      keepIt: "TV couch! Great! Everything is great! I'm stealing the window for a plant army.",
      movedIt: 'AAAH the window couch! Sit, sit, we are both sitting, this is not a drill.',
      fridgeEmpty: "FRIDGE IS EMPTY. I'm going to perish. Order snacks. Order everything.",
      lampByCouch: 'Wait wait wait. Lamp by the couch! Then I can read at night like a spooky librarian.',
      lampOn: "IT'S GLOWING! The couch is glowing! We live in a magical land!",
    },
    dry: {
      truckOffRoad: "Great. The mover can't stay on the road. Our couch is in excellent hands.",
      couchCarried: 'So the man who runs the town also moves our furniture. Efficient. Slightly concerning.',
      keepIt: "Fine. Sit in the dark. I'm sure it'll be very cozy.",
      movedIt: "See? Better. Sunlight and a couch. I'll try really hard not to say I told you so.",
      fridgeEmpty: 'The fridge contains one ice tray. No ice.',
      lampByCouch: "Actually, put it next to the couch. I'd like to read at night without squinting like a mole.",
      lampOn: "Well. That's actually nice. Don't tell anyone I said that.",
    },
    warm: {
      truckOffRoad: 'Aw, Dez, that was quite the arrival! Please tell me the boxes are okay.',
      couchCarried: "He's carrying our couch himself. I think I'm going to love it here.",
      keepIt: "Works for me! I'll find somewhere else for the sunshine.",
      movedIt: "That's perfect. Thank you, really. That's going to be my favorite spot.",
      fridgeEmpty: "Our fridge is totally empty! Let's order something in.",
      lampByCouch: "You know what? It'd be better right next to the couch. Then I can curl up and read at night.",
      lampOn: 'Oh, look at that. It makes the whole corner feel like home.',
    },
  },
  communication: {
    direct: {
      couchPlace: "Couch goes in the living room, against the TV wall. I'll tell you if it's off.",
      windowAsk: "I want the couch by the window. The light's better there. Can you move it?",
      lampCorner: "Lamp goes in the corner. Over there, where it's empty.",
    },
    diplomatic: {
      couchPlace: 'Could you help me get the couch into the living room? Over by the TV would be great, if that works for you.',
      windowAsk: "Would you mind trying the couch by the window? I think the light would be lovely there, but it's your call.",
      lampCorner: 'Could we put the lamp in that corner over there? It would fill the room nicely, if that works for you.',
    },
    playful: {
      couchPlace: 'Okay, the couch. Living room, by the TV. It is the only thing standing between us and sitting on the floor.',
      windowAsk: "So, funny thing about this window. It looks a little lonely without a couch. Just saying.",
      lampCorner: "That corner is so bare it's practically begging for a lamp. Not that I'm hinting.",
    },
    subtle: {
      couchPlace: 'That wall by the TV looks like it is waiting for something. Wonder what could go there.',
      windowAsk: "The light through that window is really something, isn't it? Hard not to picture a couch right there.",
      lampCorner: "That corner looks like it could use a little light, don't you think?",
    },
  },
};
