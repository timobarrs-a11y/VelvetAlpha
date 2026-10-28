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
      'concern.food.1': { m: "Quick survey: what are we eating tonight? Because the fridge says 'nothing' and it sounds confident.", f: "Quick survey: what are we eating tonight? Because the fridge says 'nothing' and it sounds very sure of itself." },
      'concern.food.2': { m: "Day two of the empty fridge. I've started naming the ice cubes. Can we order food?", f: "Day two of the empty fridge. I've named the ice tray. Can we please order food?" },
      'concern.food.3': { m: "I'm not talking to you till there's food in this house. I'll be over here, eating air.", f: "I'm not talking to you till there's food in this house. I'll be over here, dramatically." },
      'concern.bills.1': { m: "So the rent's late. Dez owns the power company. I'd like to keep the lights.", f: "So the rent's late. Dez owns the power company, and I like lights. Just saying." },
      'concern.bills.2': { m: "The bill's still sitting there. At some point 'late' becomes a lifestyle. Can we pay it?", f: "The bill's still sitting there. 'Late' is turning into a lifestyle. Can we pay it?" },
      'concern.bills.3': { m: "Not talking to you till the rent's paid. Ask the dark what I think.", f: "Not talking to you till the rent's paid. The dark can keep you company." },
      'concern.dishes.1': { m: "The sink has become a sculpture. Bold work. Could we wash it?", f: "The sink is doing an art installation. Very brave. Could we wash it?" },
      'concern.dishes.2': { m: "The dishes have a second day on them now. They're practically a roommate.", f: "The dishes are on day two. They're practically a roommate, and they don't pay rent." },
      'concern.laundry.1': { m: "The laundry pile is taller than the lamp. That's a milestone. Not a good one.", f: "The laundry pile just passed the lamp in height. A milestone. Not a proud one." },
      'concern.laundry.2': { m: "Still the laundry. I'm running out of socks and jokes.", f: "Still the laundry. I'm out of clean socks and nearly out of jokes." },
      'relief.food': { m: "Food. Actual food. I take back the ice cube names.", f: "Food. Actual food. I formally un-name the ice tray." },
      'relief.bills': { m: "Rent's paid. The lights live to shine another day.", f: "Rent's paid. The lights get to stay. I like the lights." },
      'relief.dishes': { m: "Clean sink. The sculpture is gone and I'm fine with that.", f: "Clean sink. The art installation has closed, and good." },
      'relief.laundry': { m: "The laundry's done. The lamp is the tallest thing again.", f: "The laundry's done. The lamp has reclaimed its title." },
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
      'concern.food.1': { m: "The fridge is EMPTY. I opened it three times to be sure. Still empty! Food? Food!", f: "The fridge is EMPTY. I checked three times in case it was shy. Food? FOOD?" },
      'concern.food.2': { m: "Two days of no food and I've eaten a condiment. A WHOLE condiment. Please order something.", f: "Two days of no food and I ate a condiment. Just the condiment. Please order something." },
      'concern.food.3': { m: "Nope. Not talking. Starving people don't talk. Buy food and I'll un-nope.", f: "Nope. Not talking. Starving ladies don't chat. Buy food and I'll un-nope." },
      'concern.bills.1': { m: "The rent is late and Dez has a BIG switch. I've seen it. It's labelled OFF.", f: "The rent is late and Dez has a BIG switch. I've seen it. It just says OFF." },
      'concern.bills.2': { m: "The bill is STILL there! It's growing! I think it has a late fee for a hat!", f: "The bill is STILL there and it's wearing a late fee like a hat! Pay it!" },
      'concern.bills.3': { m: "I'm on strike until the rent's paid. Strike snacks: none. Because no food either, probably.", f: "I'm on strike until the rent's paid. I made a sign. It just says RENT." },
      'concern.dishes.1': { m: "The dishes are stacking up like a game of Jenga. Please don't let it fall.", f: "The dishes are doing Jenga in the sink. Somebody's going to lose." },
      'concern.dishes.2': { m: "Day two of dish Jenga. Something's growing in there. I've named it Gerald.", f: "Day two of dish Jenga. Something's growing in there. Her name is Patricia." },
      'concern.laundry.1': { m: "The laundry pile moved. I'm almost sure it moved. Can we wash it before it walks?", f: "The laundry pile moved. I saw it. Can we wash it before it gets ideas?" },
      'concern.laundry.2': { m: "The laundry has officially become furniture. I sat on it. Please.", f: "The laundry is furniture now. I sat on it. It was comfy, and that's the problem." },
      'relief.food': { m: "FOOD! We have food! I'm going to look at it for a while!", f: "FOOD! We have food! I'm going to look at it lovingly for a bit!" },
      'relief.bills': { m: "Rent paid! Dez's big switch stays OFF-off! Wait. ON. The good one.", f: "Rent paid! The big switch stays the good way! Lights!" },
      'relief.dishes': { m: "Gerald is gone. The sink is a sink again. Beautiful.", f: "Patricia is gone. The sink is a sink again. Gorgeous." },
      'relief.laundry': { m: "The laundry is clean and no longer a chair!", f: "The laundry is clean and has stopped being a chair!" },
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
      'concern.food.1': { m: "There's no food. I checked the fridge. Then I checked it again, in case. There's no food.", f: "There's no food. I checked the fridge twice, in case it had changed its mind. It hadn't." },
      'concern.food.2': { m: "Still no food. It's been a day. I'm not going to make this interesting. Order some.", f: "Still no food. A whole day. I'm not going to dress this up. Order some." },
      'concern.food.3': { m: "I'm not talking to you until there's food in this house. That was the sentence.", f: "I'm not talking to you until there's food in this house. That's the whole sentence." },
      'concern.bills.1': { m: "The rent's late. Dez will cut the power. He'll be polite about it. It'll still be dark.", f: "The rent's late. Dez will cut the power, politely. It'll still be dark." },
      'concern.bills.2': { m: "The bill's still unpaid. Now with a fee. Great value.", f: "The bill's still unpaid, now with a late fee. Excellent value." },
      'concern.bills.3': { m: "Not talking until the rent's paid. Enjoy the quiet.", f: "Not talking until the rent's paid. Enjoy the quiet." },
      'concern.dishes.1': { m: "The dishes. I'm not going to describe them.", f: "The dishes. I'm not going to describe them." },
      'concern.dishes.2': { m: "The dishes are still there. They've started a family.", f: "The dishes are still there. They've started a family." },
      'concern.laundry.1': { m: "The laundry pile is a load-bearing wall now. Wash it.", f: "The laundry pile is load-bearing now. Wash it." },
      'concern.laundry.2': { m: "Still the laundry. I'm wearing a towel as a shirt. Not a joke.", f: "Still the laundry. I'm wearing a towel as a dress. Not a joke." },
      'relief.food': { m: "Food. Good. I was this close to eating a candle.", f: "Food. Good. I was this close to eating a candle." },
      'relief.bills': { m: "Rent's paid. The lights stay. Fine. Good.", f: "Rent's paid. The lights stay. Fine. Good." },
      'relief.dishes': { m: "Clean sink. I'll allow it.", f: "Clean sink. I'll allow it." },
      'relief.laundry': { m: "The laundry's done. I have a shirt again. Progress.", f: "The laundry's done. I have a shirt again. Progress." },
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
      'concern.food.1': { m: "Hey, there's nothing in the fridge. Could we order some food? I'm starting to feel it.", f: "Hey, there's nothing in the fridge. Could we order some food? I'm starting to feel it." },
      'concern.food.2': { m: "It's been a whole day with no food in the house. I'm not mad, I'm hungry. Please order something.", f: "It's been a whole day with no food in the house. I'm not mad, I'm hungry. Please order something." },
      'concern.food.3': { m: "I don't want to talk right now. Not until there's food here. I'm sorry. I mean it.", f: "I don't want to talk right now. Not until there's food here. I'm sorry, but I mean it." },
      'concern.bills.1': { m: "The rent's late, love. Dez won't wait forever, and I'd hate to sit in the dark.", f: "The rent's late. Dez won't wait forever, and I'd hate to sit in the dark." },
      'concern.bills.2': { m: "That bill's still unpaid and now there's a fee. Can we sort it today? Please?", f: "That bill's still unpaid and now there's a fee. Can we sort it today? Please?" },
      'concern.bills.3': { m: "I'm not going to talk until the rent's paid. I can't keep pretending it's fine.", f: "I'm not going to talk until the rent's paid. I can't keep pretending it's fine." },
      'concern.dishes.1': { m: "The sink's full again. Could we do the dishes together later?", f: "The sink's full again. Could we do the dishes together later?" },
      'concern.dishes.2': { m: "The dishes have been there two days now. It's getting to me. Can we wash up?", f: "The dishes have been there two days now. It's getting to me. Can we wash up?" },
      'concern.laundry.1': { m: "The laundry's piling up. A load today would be lovely.", f: "The laundry's piling up. A load today would be lovely." },
      'concern.laundry.2': { m: "Still the laundry. I'm down to the last clean shirt. Could we?", f: "Still the laundry. I'm down to my last clean shirt. Could we?" },
      'relief.food': { m: "Oh, thank goodness. Food. Thank you.", f: "Oh, thank goodness. Food. Thank you." },
      'relief.bills': { m: "Rent's paid. That's a weight off. Thank you.", f: "Rent's paid. That's a weight off. Thank you." },
      'relief.dishes': { m: "A clean sink. That's so much better.", f: "A clean sink. That's so much better." },
      'relief.laundry': { m: "Clean laundry. I could hug you.", f: "Clean laundry. I could hug you." },
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
      bedNotThere: "Bed goes against the wall, in the outline.",
      fridgeNotThere: "Fridge goes in the kitchen, where the outline is.",
      tableNotThere: "Table goes in the kitchen. The outline, please.",
      gearNotThere: "Treadmill goes in the outline. We're not working out in the hallway.",
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
      bedNotThere: "Could we try the bed in the outline against the wall? I think we'd sleep better there.",
      fridgeNotThere: "I think the fridge wants to be in the kitchen, where the outline is, if that's alright.",
      tableNotThere: "Would you mind trying the table in the outline? It'd be nice to eat in the kitchen.",
      gearNotThere: "Could the treadmill go in the outline? It'll be easier to use down there.",
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
      bedNotThere: "A bed in the middle of the room is a bold lifestyle. The outline is right there.",
      fridgeNotThere: "The fridge is wandering. Fridges live in kitchens. Outline, please.",
      tableNotThere: "Unless we're eating standing up, the table goes in the outline.",
      gearNotThere: "Treadmill's lost. It wants the outline, not the scenic route.",
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
      bedNotThere: "Hm. I'd have pictured the bed against the wall, where that outline is.",
      fridgeNotThere: "Funny, I keep looking for the fridge in the kitchen. Where the outline is.",
      tableNotThere: "The kitchen looks like it's missing a table. Right where the outline sits, maybe.",
      gearNotThere: "The outline down here looks like it's waiting for the treadmill, doesn't it?",
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
