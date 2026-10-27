import type { LineBook, Preset } from '../script/types';

/**
 * What people say in the story. `{player}`, `{partner}` and `{town}` are filled in. The partner's lines come in four
 * voices (warm, calm, bubbly, dry); Dez says the same thing to everyone, in his own.
 */
const v = (warm: string, calm: string, bubbly: string, dry: string): Record<Preset, string> => ({ warm, calm, bubbly, dry });

export const LINE_BOOK: LineBook = {
  lines: {
    // -- The opening ------------------------------------------------------------------------------------------------
    'opening.echo': v(
      'So this is it. Our place. It echoes, babe. Listen. Hellooo.',
      "It's quieter than I pictured. I like it. Feels like a page nobody's written on yet.",
      "Okay okay okay. We live here. We LIVE here. I'm going to cry, ignore me.",
      'Huh. Smaller without furniture. Or bigger. One of those.'),
    'opening.moversLate': v(
      "Movers said nine. It's nine. If they're late I'm sitting on the floor in protest.",
      'The movers should be here any minute. Everything we own, on one truck. Strange thought.',
      'Where ARE they? I need the couch. I need the kettle. I need my plant babies.',
      'The movers are late. Our whole lives are in a truck somewhere. Very relaxing.'),
    'dez.intro.1': "Hey y'all! I'm Dez! Welcome to {town}! We're mighty glad to have the two of ya!",
    'dez.intro.2': "I'm the mayor of this quaint little town, but I'm also the mover! Not that ya asked, but I run the food delivery service too.",
    'dez.intro.3': "Me and my family have lived here for ages, and we've started a few businesses 'round town, so don't hesitate to holler if ya need help!",
    'dez.intro.4': "Now, this paper here says your names are {player} and {partner}.",
    'dez.intro.5': "I've got some boxes in the truck with your names on 'em, so I'm gonna start bringing them in. Time to get 'er done!",
    'opening.mayorCarriedCouch': v(
      'Did the mayor just carry our couch? I love it here already.',
      'He seems… sweet. A lot. But sweet.',
      'THE MAYOR carried our COUCH. Best town. Best day.',
      'So one man runs the whole town. Cool. Cool cool cool.'),
    'opening.windowAsk': v(
      'Okay, hear me out. What if it\'s under the window instead? Sunday mornings, coffee, sun on our feet.',
      "Can I ask something? I'd sit here more if the light hit it. Would you mind trying it by the window?",
      'WAIT. The window! Look at that light! Can we put it there? I know I just said TV. I contain multitudes.',
      "So. The window. The light's good. The couch should be in it. I'm aware I just agreed to the TV wall."),
    'opening.keepIt': v(
      "Mm. Fine. FINE. But I'm stealing the window for something else, watch me.",
      "Okay. That's fair. I'll find the light somewhere else.",
      "TV couch! Also great. Everything's great. I'm putting a plant there though.",
      'Bold. Wrong, but bold. I\'ll allow it.'),
    'opening.movedIt': v(
      "Look at that. Look at US. Okay, that's perfect. Don't let it go to your head.",
      "Thank you. Really. That's going to be my favorite spot.",
      'AAAH. Okay sit, sit with me. Ten seconds. Then more boxes.',
      "See? Better. I'd say I told you so, but I only told you thirty seconds ago."),

    // -- Dez, in general --------------------------------------------------------------------------------------------
    'dez.getErDone': "Get 'er done!",

    // -- Chapter 7: the rest of the truck ----------------------------------------------------------------------------
    'dez.ch7.lamp': "Got your lamp here. Fragile-ish. Y'all know the drill by now.",
    'dez.ch7.stack': "I'll stack the rest of 'em right by the door. Holler if you need me. Well, don't holler, I'll be in the truck.",
    'maya.ch7.unpacked': "I did one! Don't move it. …You can move it. But don't.",

    // -- Chapter 8: Dez's card -----------------------------------------------------------------------------------------
    'dez.ch8.card': "Oh! 'Fore I forget. That there's how you reach me. Anything y'all want, you order it, and I'll bring it right on over.",
    'dez.ch8.store': "Groceries, furniture, paint, a whole dang porch swing. I got a truck for all of it.",
    'dez.ch8.groceries': "Now I'd start with groceries if I were you. Y'all look hungry, and that fridge looks emptier'n a church on Super Bowl Sunday.",

    // -- Chapter 9: groceries -----------------------------------------------------------------------------------------
    'maya.ch9.fridge': v(
      'Babe. The fridge is empty. Like, echo empty.',
      "We have nothing to eat. Let's order something in.",
      "Fridge is EMPTY. I'm going to perish. Order snacks. Order everything.",
      'The fridge contains one ice tray. No ice.'),
    'dez.ch9.arrive': "Dupree Delivers! Fresh from my cousin Darla's farm stand. Well, second cousin. Well, Darla.",
    'dez.ch9.putaway': "Y'all put them cold things away now, y'hear?",

    // -- Chapter 10: first meal ---------------------------------------------------------------------------------------
    'maya.ch10.cook': "Okay, now we have food. Who's cooking? …I'm looking at you.",
    'maya.ch10.dishes': 'That was good. …The dishes are your problem though.',
    'maya.ch10.water': 'Are we running a waterfall? The bill comes Monday.',

    // -- Chapter 11: talking ------------------------------------------------------------------------------------------
    'maya.ch11.kept': 'So you and the TV. Should I be worried?',
    'maya.ch11.moved': 'I keep looking at the couch. Thank you for that.',

    // -- Chapter 12: paint --------------------------------------------------------------------------------------------
    'maya.ch12.walls': 'These walls are so sad. Primer white. Can we make one room ours today? Just one.',
    'dez.ch12.1': 'Dupree Construction, at your service! Same fella, different hat.',
    'dez.ch12.2': "Paint, floors, wallpaper, all the fixin's. Y'all pick it, my boys'll have it on the walls 'fore lunch.",
    'maya.ch12.handOver': "You let me have the window. You pick the color. I won't say a word.",
    'maya.ch12.likes': 'Okay, that? Yes. Yes yes yes.',
    'maya.ch12.hides': "…It's a choice.",

    // -- Chapter 13: upstairs -----------------------------------------------------------------------------------------
    'maya.ch13.call': 'Come look at the bedroom! Up here!',
    'maya.ch13.bed': "Bed's still in a box somewhere. We're sleeping on the floor tonight, aren't we.",

    // -- Chapter 14: rent ---------------------------------------------------------------------------------------------
    'dez.ch14.1': "Evenin'! Mayor business this time. Just makin' the rounds, welcomin' new folks.",
    'dez.ch14.2': "Now, rent and utilities come due Monday. Pay it on time and the lights stay on. Don't, and, well, I gotta flip the switch. Ain't personal. It's the Dupree Power & Light.",
    'maya.ch14.power': '…You own the power company too?',
    'dez.ch14.3': 'Granddaddy did. I just inherited it. Like the mustache.',

    // -- Chapter 15: get 'er done -------------------------------------------------------------------------------------
    'dez.ch15.1': "Well I'll be. Look at this place! Y'all made it a home in one day.",
    'dez.ch15.2': "Town of {town}'d like to give y'all a little welcome. Here's a check for a hundred. Don't spend it all at Dupree's. …Actually, do.",
    'dez.ch15.3': 'Anything y\'all need, you know who to call.',
    'maya.ch15.kept': 'So… what do we want this life to look like?',
    'maya.ch15.moved': 'So… what do we want this life to look like? I like where we started.',
  },

  pools: {
    'dez.delivery.food': [
      "Dupree Delivers! Cold things first, y'hear?",
      "Fresh from the farm stand. Well, mostly fresh.",
      "Somebody's eatin' good tonight!",
      "Dairy's cold, bread's soft, and the peaches are Darla's pride.",
      "Y'all ordered a lot of snacks. I respect that.",
    ],
    'dez.delivery.takeout': [
      "Hot and fast, neighbor!",
      "Smells so good I nearly ate it in the truck.",
      "Takeout! Don't tell my doctor.",
      "Still warm. I drive fast but I drive careful.",
    ],
    'dez.delivery.furniture': [
      "Got your box right here! Heavier'n it looks.",
      "Lift with the legs, friend. That's what Granddaddy always said.",
      "One box, delivered with love and a little bit of back pain.",
      "Mind the corners, they bite.",
      "Set 'er down right here. You can unpack it whenever.",
    ],
    'dez.delivery.decor': [
      "Somethin' pretty for the house! I didn't peek. Much.",
      "Fragile! Which is fancy for 'handle with love'.",
      "Decor delivery! Y'all have good taste.",
      "Little box, big personality.",
    ],
    'dez.delivery.paint': [
      "Dupree Construction! My boys'll be done 'fore the coffee cools.",
      "Fresh paint, fresh start. Wet paint, so don't lean.",
      "New look comin' right up. Same fella, different hat.",
      "Y'all picked a good one. I'd have said so even if ya hadn't.",
    ],
  },
};
