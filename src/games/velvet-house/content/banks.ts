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
    },
    goofy: {
      truckOffRoad: 'Did anyone else see the truck go full off-road? Because I did, and I want a ride.',
      couchCarried: 'THE MAYOR. IS CARRYING. OUR COUCH. Somebody put this on a postage stamp.',
      keepIt: "TV couch! Great! Everything is great! I'm stealing the window for a plant army.",
      movedIt: 'AAAH the window couch! Sit, sit, we are both sitting, this is not a drill.',
    },
    dry: {
      truckOffRoad: "Great. The mover can't stay on the road. Our couch is in excellent hands.",
      couchCarried: 'So the man who runs the town also moves our furniture. Efficient. Slightly concerning.',
      keepIt: "Fine. Sit in the dark. I'm sure it'll be very cozy.",
      movedIt: "See? Better. Sunlight and a couch. I'll try really hard not to say I told you so.",
    },
    warm: {
      truckOffRoad: 'Aw, Dez, that was quite the arrival! Please tell me the boxes are okay.',
      couchCarried: "He's carrying our couch himself. I think I'm going to love it here.",
      keepIt: "Works for me! I'll find somewhere else for the sunshine.",
      movedIt: "That's perfect. Thank you, really. That's going to be my favorite spot.",
    },
  },
  communication: {
    direct: {
      couchPlace: "Couch goes in the living room, against the TV wall. I'll tell you if it's off.",
      windowAsk: "I want the couch by the window. The light's better there. Can you move it?",
    },
    diplomatic: {
      couchPlace: 'Could you help me get the couch into the living room? Over by the TV would be great, if that works for you.',
      windowAsk: "Would you mind trying the couch by the window? I think the light would be lovely there, but it's your call.",
    },
    playful: {
      couchPlace: 'Okay, the couch. Living room, by the TV. It is the only thing standing between us and sitting on the floor.',
      windowAsk: "So, funny thing about this window. It looks a little lonely without a couch. Just saying.",
    },
    subtle: {
      couchPlace: 'That wall by the TV looks like it is waiting for something. Wonder what could go there.',
      windowAsk: "The light through that window is really something, isn't it? Hard not to picture a couch right there.",
    },
  },
};
