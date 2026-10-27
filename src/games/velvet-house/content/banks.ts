import type { LineBank } from '../script/types';

/**
 * Lines that depend on how the companion talks, keyed by what the player picked when making them. A script asks for a
 * bank and a slot (`{ bank: 'humor', slot: 'couchCarried' }`) and gets the line for this companion's humor, or
 * communication style, in a masculine (`m`) or feminine (`f`) voice; a plain string is the same for everyone.
 * Slots are situations, not wording, so the same slot is written for every style.
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
      truckOffRoad: {
        m: "Bold parking, Dez. Is the curb optional in {town}, or just the road? Asking for the tree.",
        f: "Bold parking, Dez. Is the curb optional in {town}, or just the road? That tree had a family.",
      },
      couchCarried: {
        m: "The mayor of {town} is hauling our couch personally. I feel like we owe him a vote.",
        f: "The mayor of {town} is hauling our couch personally. I feel like we owe him a vote and a casserole.",
      },
      fridgeEmpty: {
        m: "The fridge contains one ice tray and a lot of potential. Let's order something before the potential starves.",
        f: "The fridge contains one ice tray and a lot of potential. Let's order something, I refuse to eat potential.",
      },
      lampByCouch: {
        m: "On second thought, the lamp belongs next to the couch. Reading light is a basic human right.",
        f: "On second thought, the lamp belongs next to the couch. I have books, and they have opinions about dark corners.",
      },
      lampOn: {
        m: "And there's the light. Look at the couch glow. I'd like to formally thank the lamp.",
        f: "And there's the light. Look at the couch glow. The lamp and I are going to be very close.",
      },
    },
    goofy: {
      truckOffRoad: {
        m: "Did anyone else see the truck go full off-road? Because I did, and I want a ride.",
        f: "Did anyone else see the truck go full off-road? That tree never saw it coming. Neither did I. Amazing.",
      },
      couchCarried: {
        m: "THE MAYOR. IS CARRYING. OUR COUCH. Somebody put this on a postage stamp.",
        f: "THE MAYOR. IS CARRYING. OUR COUCH. I need a photo, a plaque, and a moment.",
      },
      fridgeEmpty: {
        m: "FRIDGE IS EMPTY. I'm going to perish. Order snacks. Order everything.",
        f: "FRIDGE IS EMPTY. I am a husk. Order snacks. Order everything. Order a second fridge.",
      },
      lampByCouch: {
        m: "Wait wait wait. Lamp by the couch! Then I can read at night like a spooky librarian.",
        f: "Wait wait wait. Lamp by the couch! Then I can read at night like a glamorous spooky librarian.",
      },
      lampOn: {
        m: "IT'S GLOWING! The couch is glowing! We live in a magical land!",
        f: "IT'S GLOWING! The couch is glowing! I'm going to sit in it and never ever leave!",
      },
    },
    dry: {
      truckOffRoad: {
        m: "Great. The mover can't stay on the road. Our couch is in excellent hands.",
        f: "Great. The mover can't stay on the road. He did, however, beat the tree. Our couch is in excellent hands.",
      },
      couchCarried: {
        m: "So the man who runs the town also moves our furniture. Efficient. Slightly concerning.",
        f: "So the man who runs the town also moves our furniture. Efficient. I have questions, and I'll keep them.",
      },
      fridgeEmpty: {
        m: "The fridge contains one ice tray. No ice.",
        f: "The fridge contains one ice tray. No ice. I'm not even surprised.",
      },
      lampByCouch: {
        m: "Actually, put it next to the couch. I'd like to read at night without squinting like a mole.",
        f: "Actually, put it next to the couch. I'd like to read at night, and the corner doesn't do reading.",
      },
      lampOn: {
        m: "Well. That's actually nice. Don't tell anyone I said that.",
        f: "Well. That's actually nice. I'll deny saying so.",
      },
    },
    warm: {
      truckOffRoad: {
        m: "Aw, Dez, that was quite the arrival! Please tell me the boxes are okay. And the tree.",
        f: "Aw, Dez, that was quite the arrival! Please tell me the boxes are okay. Poor tree.",
      },
      couchCarried: {
        m: "He's carrying our couch himself. I think I'm going to love it here.",
        f: "He's carrying our couch himself. I think I'm going to love it here already.",
      },
      fridgeEmpty: {
        m: "Our fridge is totally empty! Let's order something in.",
        f: "Our fridge is totally empty! Let's order something in and call it our first dinner.",
      },
      lampByCouch: {
        m: "You know what? It'd be better right next to the couch. Then I can curl up and read at night.",
        f: "You know what? It'd be better right next to the couch. Then I can curl up with a book at night.",
      },
      lampOn: {
        m: "Oh, look at that. It makes the whole corner feel like home.",
        f: "Oh, look at that. It makes the whole corner feel like ours.",
      },
    },
  },
  communication: {
    direct: {
      couchPlace: {
        m: "Couch goes in the living room, against the TV wall. I'll tell you if it's off.",
        f: "Couch goes in the living room, against the TV wall. I'll tell you if it's off.",
      },
      couchNotThere: {
        m: "Not there. By the TV, facing it.",
        f: "Not there. By the TV, facing it.",
      },
      lampCorner: {
        m: "Lamp goes in the corner by the TV. Right of it, where the wall is empty.",
        f: "Lamp goes in the corner by the TV. Right of it, where the wall is empty.",
      },
      lampNotThere: {
        m: "That's not the spot. Look at the outline.",
        f: "That's not the spot. Look at the outline.",
      },
    },
    diplomatic: {
      couchPlace: {
        m: "Could you help me get the couch into the living room? Over by the TV would be great, if that works for you.",
        f: "Could you help me get the couch into the living room? Over by the TV would be great, if that works for you.",
      },
      couchNotThere: {
        m: "Hmm, I think it wants to be a little closer to the TV. Would you mind trying the outline?",
        f: "Hmm, I think it wants to be a little closer to the TV. Would you mind trying the outline?",
      },
      lampCorner: {
        m: "Could we put the lamp in the corner by the TV? That empty bit of wall could use it, if that works for you.",
        f: "Could we put the lamp in the corner by the TV? That empty bit of wall could use it, if that works for you.",
      },
      lampNotThere: {
        m: "Almost! Could you nudge it into the outline for me?",
        f: "Almost! Could you nudge it into the outline for me?",
      },
    },
    playful: {
      couchPlace: {
        m: "Okay, the couch. Living room, by the TV. It is the only thing standing between us and sitting on the floor.",
        f: "Okay, the couch. Living room, by the TV. It is the only thing standing between us and sitting on the floor.",
      },
      couchNotThere: {
        m: "Bold choice. Wrong, but bold. The TV is over there, in case it's hiding from you.",
        f: "Bold choice. Wrong, but bold. The TV is over there, in case it's hiding from you.",
      },
      lampCorner: {
        m: "That corner by the TV is so bare it's practically begging for a lamp. Not that I'm hinting.",
        f: "That corner by the TV is so bare it's practically begging for a lamp. Not that I'm hinting.",
      },
      lampNotThere: {
        m: "Warmer. Colder. Okay, that's just somewhere else. The outline, friend.",
        f: "Warmer. Colder. Okay, that's just somewhere else. The outline, friend.",
      },
    },
    subtle: {
      couchPlace: {
        m: "That wall by the TV looks like it is waiting for something. Wonder what could go there.",
        f: "That wall by the TV looks like it is waiting for something. Wonder what could go there.",
      },
      couchNotThere: {
        m: "Huh. Funny place for a couch. The TV wall still looks a bit lonely, doesn't it?",
        f: "Huh. Funny place for a couch. The TV wall still looks a bit lonely, doesn't it?",
      },
      lampCorner: {
        m: "That corner beside the TV looks like it could use a little light, don't you think?",
        f: "That corner beside the TV looks like it could use a little light, don't you think?",
      },
      lampNotThere: {
        m: "Interesting. I'd have pictured it a little more... over there. Where the outline is.",
        f: "Interesting. I'd have pictured it a little more... over there. Where the outline is.",
      },
    },
  },
};
