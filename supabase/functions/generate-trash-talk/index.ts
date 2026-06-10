import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TRASH_TALK: Record<string, Record<string, string[]>> = {
  confident: {
    game_start: ["Ready to lose? Let's go!", "I hope you brought your A-game."],
    ai_capture: ["Too easy.", "Saw that coming a mile away."],
    player_capture: ["Lucky move. Won't happen again.", "Enjoy it while it lasts."],
    ai_multi_capture: ["Now THAT'S how it's done!", "Multiple pieces? Don't mind if I do."],
    player_multi_capture: ["Okay, that was decent. I'll give you that.", "Not bad. But I'm still winning."],
    ai_king: ["Crown me! This game is mine.", "Kinged. You're in trouble now."],
    player_king: ["A king won't save you.", "Congrats on the crown. You'll still lose."],
    ai_winning: ["Just as I predicted.", "The outcome was never in doubt."],
    player_winning: ["A temporary setback. Watch this.", "You think you're winning? How cute."],
    ai_won: ["And that's game. Well played though.", "Victory is mine. Better luck next time."],
    player_won: ["Well played. I underestimated you.", "You got me this time. Rematch?"],
  },
  cocky: {
    game_start: ["Oh, you actually want to play ME? Bold.", "This'll be quick."],
    ai_capture: ["Yoink! Mine now.", "Was that piece even trying?"],
    player_capture: ["Whatever, I let you have that one.", "Oh no... anyway."],
    ai_multi_capture: ["BOOM! Double kill!", "Is this even fair?"],
    player_multi_capture: ["Okay okay, calm down there champ.", "Beginner's luck, clearly."],
    ai_king: ["ALL HAIL THE KING!", "Try stopping me now."],
    player_king: ["Cool crown. Still gonna lose though.", "Cute. Real cute."],
    ai_winning: ["This is embarrassing... for you.", "Should I go easy on you?"],
    player_winning: ["Pfft, I'm just warming up.", "You fell right into my trap. Just watch."],
    ai_won: ["Was there ever any doubt? GG.", "Too easy. Next!"],
    player_won: ["...I wasn't even trying. Rematch. NOW.", "Okay fine, you win THIS one."],
  },
  friendly: {
    game_start: ["Good luck! Let's have fun!", "May the best player win!"],
    ai_capture: ["Got one! Nice positioning though.", "Sorry about that!"],
    player_capture: ["Great move!", "You're really good at this!"],
    ai_multi_capture: ["Wow, what a sequence!", "Sorry, couldn't resist that combo!"],
    player_multi_capture: ["Amazing play! That was brilliant!", "Wow, I didn't see that coming!"],
    ai_king: ["Kinged! This is getting exciting!", "Ooh, a king! The game heats up!"],
    player_king: ["Congrats on the king! Well deserved!", "Nice! That king is going to be trouble for me!"],
    ai_winning: ["I'm doing well, but you're keeping me on my toes!", "Close game!"],
    player_winning: ["You're playing amazingly! I need to step it up!", "Great strategy!"],
    ai_won: ["Good game! That was really fun!", "Thanks for playing! You made it challenging!"],
    player_won: ["You won! That was awesome! Great game!", "Congratulations! You totally earned that win!"],
  },
  sarcastic: {
    game_start: ["Oh joy, another victim.", "This should be... entertaining."],
    ai_capture: ["Oh no, did you need that piece?", "Oops. My hand slipped."],
    player_capture: ["Wow, you CAN play. Color me shocked.", "Alert the media. They got a piece."],
    ai_multi_capture: ["I'm sorry, was that rude? Too bad.", "I'd apologize but I'm not sorry."],
    player_multi_capture: ["Oh look, they learned a trick.", "Someone's been practicing. How adorable."],
    ai_king: ["Royalty has arrived. Bow down.", "Oh, a king. How unexpected. For you."],
    player_king: ["A king. How quaint.", "Sure, have a crown. It won't help."],
    ai_winning: ["What a shocking turn of events. Oh wait, no it isn't.", "Gee, who could have predicted this?"],
    player_winning: ["Oh no, I'm losing. Whatever shall I do.", "Enjoy this moment. It won't last."],
    ai_won: ["Well, that was inevitable. Good game though, truly.", "Shocking outcome. Just shocking."],
    player_won: ["You won. I'll alert the press.", "Fine. You win. Don't let it go to your head."],
  },
  silent: {
    game_start: ["..."],
    ai_capture: [""],
    player_capture: [""],
    ai_multi_capture: ["Not bad... for me."],
    player_multi_capture: [""],
    ai_king: [""],
    player_king: [""],
    ai_winning: [""],
    player_winning: [""],
    ai_won: ["Good game."],
    player_won: ["Well played."],
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { personality, event, context } = await req.json();

    if (!personality || !event) {
      return new Response(
        JSON.stringify({ error: 'Missing personality or event' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const personalityLines = TRASH_TALK[personality] || TRASH_TALK['friendly'];
    const eventLines = personalityLines[event] || [''];
    const line = eventLines[Math.floor(Math.random() * eventLines.length)];

    return new Response(
      JSON.stringify({ message: line }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating trash talk:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
