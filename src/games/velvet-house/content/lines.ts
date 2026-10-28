import type { LineBook } from '../script/types';
import { BANKS } from './banks';

/**
 * What people say in the story. `{player}`, `{partner}` and `{town}` are filled in. Lines that follow the partner's
 * humor or communication style live in banks.ts; Dez says the same thing to everyone, in his own. A line can have a
 * `.friend` version ("line.friend") for a friend who has moved in as a roommate.
 */
export const LINE_BOOK: LineBook = {
  banks: BANKS,
  lines: {
    // -- The opening ------------------------------------------------------------------------------------------------
    // `**...**` is shown bold, in green: the town's name stands out.
    'dez.welcome': "Come on in guys! Welcome to **{town}**!",
    'dez.brushOff': "Ha! Roads are more of a suggestion 'round here. Anywho! We're mighty glad to have the two of ya!",
    'dez.intro.2': "It's a small town, but it's growing every day! Soon as I leave here I got another delivery! That reminds me, I forgot to mention I'm the mayor of this little town, and also the mover! Not that ya asked, but I run the food delivery service too.",
    'dez.intro.3': "Now, I know what y'all are thinkin, but me and my family have lived here for ages, and we've started a few businesses 'round town, so don't hesitate to holler if ya need help!",
    // Only said to a friend who has moved in: two people splitting a place.
    'dez.roommates': "Now I hear y'all are roommates! Best kind of arrangement. Nobody argues over who sleeps on which side. Just who forgot to buy toilet paper.",
    'dez.names': "Now let's see here... your names were {player} and {partner}, right?",
    'dez.firstBox': "Alright, here's your first box. I'll go grab some more.",

    // -- Dez, in general --------------------------------------------------------------------------------------------
    'dez.getErDone': "Get 'er done!",

    // -- Chapter 7: the rest of the truck ----------------------------------------------------------------------------
    'dez.ch7.noLabel': "This one doesn't have a label!",
    'dez.ch7.plant': "One more. Y'all know the drill by now.",
    'dez.ch7.bed': "Heavy one, this. Y'all figure out where it goes, I'll go catch my breath.",
    'dez.ch7.comeDown': "Y'all come on down when you're ready, I got the rest of it!",
    'dez.ch7.threeBoxes': "That's the lot. Kitchen stuff, and somethin' for downstairs. Get 'er done!",

    // -- Chapter 8: Dez's card -----------------------------------------------------------------------------------------
    'dez.ch8.card': "Oh! 'Fore I forget. That there's how you reach me. Anything y'all want, you order it, and I'll bring it right on over.",
    'dez.ch8.store': "Groceries, furniture, paint, a whole dang porch swing. I got a truck for all of it.",
    'dez.ch8.groceries': "Now I'd start with groceries if I were you. Y'all look hungry, and that fridge looks emptier'n a church on Super Bowl Sunday.",

    // -- Chapter 9: groceries -----------------------------------------------------------------------------------------
    'dez.ch9.arrive': "Dupree Delivers! Fresh from my cousin Darla's farm stand. Well, second cousin. Well, Darla.",
    'dez.ch9.putaway': "Y'all put them cold things away now, y'hear?",

    // -- Chapter 10: first meal ---------------------------------------------------------------------------------------
    'maya.ch10.cook': "Okay, now we have food. Who's cooking? …I'm looking at you.",
    'maya.ch10.dishes': 'That was good. …The dishes are your problem though.',
    'maya.ch10.water': 'Are we running a waterfall? The bill comes Monday.',

    // -- Chapter 11: talking ------------------------------------------------------------------------------------------
    'maya.ch11.kept': 'So you and the TV. Should I be worried?',

    // -- Chapter 12: paint --------------------------------------------------------------------------------------------
    'maya.ch12.walls': 'These walls are so sad. Primer white. Can we make one room ours today? Just one.',
    'dez.ch12.1': 'Dupree Construction, at your service! Same fella, different hat.',
    'dez.ch12.2': "Paint, floors, wallpaper, all the fixin's. Y'all pick it, my boys'll have it on the walls 'fore lunch.",
    'maya.ch12.likes': 'Okay, that? Yes. Yes yes yes.',
    'maya.ch12.hides': "…It's a choice.",

    // -- Chapter 13: upstairs -----------------------------------------------------------------------------------------
    'maya.ch13.call': 'Come look at the bedroom! Up here!',
    'maya.ch13.bed': "Bed's still in a box somewhere. We're sleeping on the floor tonight, aren't we.",
    'maya.ch13.bed.friend': 'Two beds, one room, zero privacy. We will make it work. Come see!',

    // -- Chapter 14: rent ---------------------------------------------------------------------------------------------
    'dez.ch14.1': "Evenin'! Mayor business this time. Just makin' the rounds, welcomin' new folks.",
    'dez.ch14.2': "Now, rent and utilities come due Monday. Pay it on time and the lights stay on. Don't, and, well, I gotta flip the switch. Ain't personal. It's the Dupree Power & Light.",
    'maya.ch14.power': '…You own the power company too?',
    'dez.ch14.3': 'Granddaddy did. I just inherited it. Like the mustache.',

    // -- Chapter 15: get 'er done -------------------------------------------------------------------------------------
    'dez.ch15.1': "Well I'll be. Look at this place! Y'all made it a home in one day.",
    'dez.ch15.2': "Town of {town}'d like to give y'all a little welcome. Here's a check for a hundred. Don't spend it all at Dupree's. …Actually, do.",
    'dez.ch15.3': 'Anything y\'all need, you know who to call.',
    'maya.ch15.kept.friend': 'So… what do we want this place to look like?',
    'maya.ch15.kept': 'So… what do we want this life to look like?',
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
