// Bespoke per-scenario dialogue, objectives, endings, and story beats.
// Keys match `${conflict.id}_${opponent.id}` from genScenario().

export type RespType = 'empathy' | 'logic' | 'manipulation' | 'aggression' | 'cunning';

export interface StoryBeat {
  id: string;
  // At least one trigger must match. All specified triggers must match simultaneously.
  trigger: {
    round?: number;           // fires when round === this value
    roundGte?: number;        // fires when round >= this value (once)
    playerHpBelow?: number;   // fires when player HP drops below threshold
    opponentHpBelow?: number; // fires when opponent HP drops below threshold
    opponentEmotion?: string; // fires when opponent emotion becomes this
  };
  narrative?: string;    // italicized scene description inserted into dialogue
  opponentLine?: string; // opponent speaks an out-of-turn line (no damage calc)
}

export interface ScenarioScript {
  intro?: string;
  opponentBarks?: Partial<Record<string, string>>;
  opponentReacts?: Partial<Record<string, Partial<Record<RespType, string>>>>;
  playerLines?: Partial<Record<string, Partial<Record<RespType, string>>>>;
  beats?: StoryBeat[];
}

export interface Objective {
  id: string;
  label: string;
  check: (summary: ObjectiveSummary) => boolean;
}

export interface Ending {
  id: string;
  title: string;
  body: string;
  condition: (summary: ObjectiveSummary) => boolean;
}

export interface ObjectiveSummary {
  isVictory: boolean;
  turns: number;
  finalPlayerHp: number;
  finalOpponentHp: number;
  maxCombo: number;
  counts: Record<string, number>;
  finalOpponentEmotion: string;
  usedUltimate: boolean;
  emotionsVisited: string[];
}

const count = (s: ObjectiveSummary, t: RespType) => s.counts[t] ?? 0;

// ============================================================
// SCENARIO SCRIPTS  (25 pairs)
// ============================================================

export const SCENARIO_SCRIPTS: Record<string, ScenarioScript> = {

  // ────── GROUP PROJECT ──────

  group_project_slacker: {
    intro: "Jake hasn't shown up to a single meeting. You texted twice. It's 9 PM the night before it's due and he's online — you can see him on Discord, playing games.",
    opponentBarks: {
      lazy: "Oh hey. Yeah, the project. I was gonna get to it, honestly — just been a week, you know?",
      guilty: "I know. I know I've let you down. I just... I couldn't make myself start it.",
    },
    opponentReacts: {
      lazy: {
        empathy: "Look... I haven't told anyone, but my mom's been in the hospital. That's why I've been checked out. I didn't know how to say it.",
        aggression: "Whoa. Chill. It's a group project, not the Nuremberg trials.",
        logic: "Okay, fine. Send me whatever part's left. I'll crank it out tonight. Scout's honor.",
        cunning: "Huh. Hadn't thought of splitting it that way. That might actually work.",
      },
      guilty: {
        empathy: "Thank you for not — I thought you'd just go to the professor. I'll do whatever you need me to do.",
        logic: "Right. The data section. I can do that. Give me two hours.",
        aggression: "Yelling isn't going to help me focus right now. It really isn't.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Jake, I'm not here to bury you. Something's clearly off. What's actually going on?",
        logic: "Here's where we stand: section four is empty, the deadline's in eleven hours. What specifically can you own tonight?",
        aggression: "I'm not carrying your name to a B. Get the work in or I submit with mine only.",
        cunning: "What if you take the data section and I finish the analysis? Your name is on the grade either way — let's make it worth something.",
      },
      athlete: {
        empathy: "Hey. Team check. You're completely gone lately. What happened?",
        logic: "One section. Two hours. That's all I'm asking. Can you do that or not?",
        aggression: "We're down in the fourth quarter and you've been sitting on the bench all month. I need you in the game. Now.",
        cunning: "I'll cover for you with the professor if you finish the data section tonight. Deal?",
      },
      artist: {
        empathy: "I can feel you shutting down every time I bring this up. I'm not attacking you — I'm worried. What's going on underneath all this?",
        logic: "Let's break it into pieces. Just the introduction. Can you write five sentences about our thesis?",
        aggression: "This isn't creative block, Jake. This is just not showing up. I need more.",
        cunning: "What if you narrate your section and I clean it up? You don't even have to type it — just talk it out.",
      },
    },
    beats: [
      {
        id: 'mom_reveal',
        trigger: { round: 3 },
        opponentLine: "...my mom had a procedure two weeks ago. I've been driving to the hospital every night. I should have said something.",
      },
      {
        id: 'late_night',
        trigger: { roundGte: 5 },
        narrative: "Outside, a car passes. The clock on his screen reads 11:47 PM.",
      },
      {
        id: 'jake_low_hp',
        trigger: { opponentHpBelow: 30 },
        opponentLine: "Okay. Okay. I'm opening the doc right now. Just — I'm sorry. I really am.",
      },
    ],
  },

  group_project_perfectionist: {
    intro: "Sarah reorganized your entire slide deck at 2 AM and rewrote your section. It's technically cleaner. It's also not yours. And your name is on it.",
    opponentBarks: {
      confident: "I know you're probably a little annoyed, but trust me — the version I put together is going to get us an A.",
      doubtful: "Was it wrong of me to change it? I genuinely couldn't sleep leaving it the way it was.",
    },
    opponentReacts: {
      confident: {
        empathy: "Look, I just... I can't turn in something average. My whole scholarship is riding on GPA and I panic. I panic and I fix things.",
        logic: "You're right, I should've asked. I don't actually know if my version is better — I just couldn't stop myself.",
        cunning: "Wait — what if we submit yours and mine gets noted as supplemental? That way we both... okay, that sounds insane out loud.",
        aggression: "I was trying to help! I stayed up until 3 AM for this project!",
      },
      doubtful: {
        empathy: "I don't know how to explain it. It's like when something's imperfect I can feel it. It's actually kind of miserable.",
        logic: "My version does score higher on the rubric — I mapped it against last year's graded samples. But that doesn't make it okay.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Sarah. I need you to hear this: it wasn't yours to fix. But I'm more interested in why you needed to than angry that you did.",
        logic: "The rubric doesn't require perfection. It requires your perspective and mine. You removed mine.",
        aggression: "You overwrote six hours of my work. At 2 AM. Without asking. That is not okay.",
        cunning: "What if we merge them? Your structure, my original analysis — we both come out looking collaborative.",
      },
      athlete: {
        empathy: "Sarah, I can see you're running on empty. When did the scholarship stress start eating you like this?",
        logic: "You changed my section. On a team project. There are two people on this team.",
        aggression: "That was my work. You don't get to erase it just because you think you can do it better.",
        cunning: "Here's what we do: you get credit for the structure in the acknowledgements, I restore my analysis. Everyone sees everyone's work.",
      },
      artist: {
        empathy: "I can feel how scared you are underneath all the fixing. What are you actually afraid of?",
        logic: "Original voice matters. The professor wants to see how two people think, not one person thinking twice.",
        manipulation: "Imagine if we combined both versions — yours and mine — and it ended up being the strongest submission in the class.",
        cunning: "What if I told the professor we did a structural experiment? Two drafts, one document. That's actually kind of interesting.",
      },
    },
    beats: [
      {
        id: 'scholarship_context',
        trigger: { round: 2 },
        narrative: "There are dark circles under Sarah's eyes. She's been awake for twenty hours.",
      },
      {
        id: 'sarah_breaks',
        trigger: { opponentHpBelow: 40 },
        opponentLine: "My dad said if my GPA drops below 3.8 he's pulling funding. I know that's not your problem. I'm sorry.",
      },
      {
        id: 'final_stretch',
        trigger: { roundGte: 6 },
        narrative: "The deadline is in four hours. Outside, campus is silent.",
      },
    ],
  },

  group_project_hothead: {
    intro: "Marcus exploded at you last week when you asked where his section was — called it micromanaging in front of the whole group. Now the deadline is tonight and his section is blank.",
    opponentBarks: {
      annoyed: "Before you say anything — I know. I know. I've been dealing with stuff.",
      angry: "You're going to stand there and lecture me like I'm a child? I don't need this.",
    },
    opponentReacts: {
      annoyed: {
        empathy: "Don't give me the soft voice. I'm not a kid. Just... tell me what you need from me.",
        logic: "Fine. Give me the outline. I'll do the conclusion. That's what's missing, right?",
        aggression: "You want to do this right now? Really? Let's go.",
        cunning: "What do you mean 'split it differently'? How?",
      },
      angry: {
        empathy: "...I'm not doing this with you tonight. I'm too — I can't.",
        logic: "You think this is about the project. It's not about the project.",
        aggression: "There it is. There's the fight I knew was coming.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Marcus. I'm not here to relitigate last week. What's actually going on with you right now?",
        logic: "The conclusion is two paragraphs. I have a draft. Can you add your voice to it or not?",
        aggression: "You blew up at me for asking a reasonable question. Now I'm asking again. Where is your section?",
      },
      athlete: {
        empathy: "Man, forget the project for a second. You've been off for weeks. What's happening?",
        logic: "Conclusion. Two paragraphs. I need yes or no.",
        aggression: "I'm not scared of you, Marcus. I'm just tired of covering for you.",
      },
      artist: {
        empathy: "Something happened. I don't know what. But I can feel it and I'm not going to pretend I don't.",
        logic: "Can we just get to a workable outcome here — for both of us?",
        cunning: "What if you voice-memo your section and I transcribe it? You don't have to touch the document.",
      },
    },
    beats: [
      {
        id: 'marcus_wall',
        trigger: { round: 2 },
        narrative: "Marcus doesn't make eye contact. His jaw is tight. Whatever is happening, it predates this project.",
      },
      {
        id: 'marcus_crack',
        trigger: { opponentHpBelow: 35 },
        opponentLine: "I got put on academic probation two weeks ago. I didn't tell anyone. I'm probably not coming back next semester.",
      },
    ],
  },

  group_project_manipulator: {
    intro: "Alex suggested the project topic, delegated all the actual work to you, and has been subtly framing every deliverable as 'our shared vision.' The professor thinks you're co-leading. Alex isn't leading anything.",
    opponentBarks: {
      confident: "I'm really glad we've been such a strong team this semester. The dynamic we've built is special.",
    },
    opponentReacts: {
      confident: {
        cunning: "Okay. Cards on the table. What do you actually want from this?",
        logic: "I've contributed strategy. That's real labor — it just doesn't show up in word count.",
        empathy: "I hear you feeling unseen. I do. Let me think about how I can make that right.",
        aggression: "Is this really the hill you want to die on, the night before submission?",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Alex, I don't think you're malicious. I think you're very good at distributing work in ways that benefit you. I'd like to talk about it.",
        logic: "I have a log of every deliverable, who wrote it, and when. I'm happy to share it.",
        cunning: "What if the acknowledgements section reflected who actually wrote what? I'll draft it — you can review.",
        aggression: "You contributed one email and an initial concept. I wrote everything else. That gets corrected before we submit.",
      },
      athlete: {
        logic: "Show me your draft. Any draft. Anything with your name on it that you wrote.",
        aggression: "I've been doing your work all semester. That ends tonight.",
        cunning: "Here's my offer: I finish the project, you publicly credit me to Professor Reeves next class. That's the deal.",
      },
      artist: {
        empathy: "I wonder sometimes if you even notice you're doing it — taking things without asking. What does that feel like from inside?",
        logic: "The document history doesn't lie. Every edit has a timestamp.",
        cunning: "What if we restructure the submission to have named sections? Accountability by design.",
      },
    },
    beats: [
      {
        id: 'alex_pivot',
        trigger: { round: 3 },
        opponentLine: "You're smarter than most people I work with. That's actually why I chose you for this.",
      },
      {
        id: 'alex_cornered',
        trigger: { opponentHpBelow: 30 },
        opponentLine: "Fine. Tell me what you need — credit, grade adjustment, whatever. I'm listening.",
      },
    ],
  },

  group_project_anxious: {
    intro: "Emma is so paralyzed by fear of failing that she hasn't typed a single word. Every time you check in she apologizes and disappears. The deadline is 8 AM.",
    opponentBarks: {
      vulnerable: "I'm so sorry. I know I'm letting you down. I've opened the document fifty times and I just — I can't.",
    },
    opponentReacts: {
      vulnerable: {
        empathy: "You're not mad? I thought you'd be furious. I've been dreading this conversation for days.",
        logic: "If you break it down into steps — small steps — I think I can do that. I do better with small steps.",
        aggression: "Please don't yell. I know I deserve it. I just — I need a minute.",
        cunning: "You'd really do it that way? You'd work around me? I feel terrible but also... thank you.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Emma. I'm not angry. I'm asking because I want to actually help. What's the real block?",
        logic: "Let's scope it down. Not the whole section — just the first sentence. What's the first thing you'd say about our topic?",
        aggression: "I need you to try. I'm not asking for perfect — I'm asking for something.",
        cunning: "What if you write notes in a voice memo and I shape it into prose? You'd barely have to touch the doc.",
      },
      athlete: {
        empathy: "Hey. Look at me. You're not failing. You're stuck. Those are different things.",
        logic: "Three bullet points. That's it. Just three things you know about the topic.",
        aggression: "I know you're scared. But I need you to push through it. Just this once.",
      },
      artist: {
        empathy: "I can feel how much you've been carrying this alone. You don't have to be alone in it.",
        logic: "Let's make this tiny. What's one true thing you could say about our research question?",
        cunning: "What if your whole section was written as observations — like field notes? No pressure to argue anything.",
      },
    },
    beats: [
      {
        id: 'emma_backstory',
        trigger: { round: 3 },
        opponentLine: "I failed an exam in October. The professor said my analysis was 'surface level.' I haven't been able to write anything since.",
      },
      {
        id: 'almost_there',
        trigger: { opponentHpBelow: 35 },
        opponentLine: "I'm going to try. Right now. I'm going to open it and I'm going to try.",
      },
    ],
  },

  // ────── ROOMMATE DRAMA ──────

  roommate_drama_slacker: {
    intro: "Jake has been living like the apartment is a hotel. Dishes from three days ago. Empty pizza boxes. A stranger on the couch at 2 AM last Tuesday. You pay equal rent.",
    opponentBarks: {
      lazy: "Dude, relax. It's not that bad. I'll clean up this weekend, I swear.",
    },
    opponentReacts: {
      lazy: {
        empathy: "I don't think I realized it was actually bothering you. You always seemed chill about it.",
        logic: "A schedule? Like a literal chore schedule? That's kind of... yeah, okay, that might work for me.",
        aggression: "Okay, okay, no need to blow up. I get it. I'll handle it.",
        cunning: "Wait, so you'll take trash if I handle dishes? Deal. That's a deal.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Jake, I don't want to be your landlord. I just need to understand why this keeps happening.",
        logic: "This is the fourth time in two months. The lease says shared maintenance. I have a list.",
        aggression: "The stranger on the couch at 2 AM was the last straw. That doesn't happen again.",
        cunning: "What if we set a Friday reset — both of us, twenty minutes, common areas? It doesn't have to be a whole thing.",
      },
      athlete: {
        empathy: "You seem fine, but the apartment isn't. What's going on in your life right now?",
        logic: "Shared space, shared responsibility. That's the deal we agreed to.",
        aggression: "Clean it up. Not this weekend. Today.",
      },
      artist: {
        empathy: "I don't think you're trying to be inconsiderate. But the apartment feels like it's only mine to care about. That hurts.",
        cunning: "What if we did it together right now — just put on a playlist, knock it out in thirty minutes?",
      },
    },
    beats: [
      {
        id: 'stranger_context',
        trigger: { round: 2 },
        narrative: "Jake glances at the couch. The stranger left a jacket. He hasn't moved it.",
      },
      {
        id: 'jake_lease_reality',
        trigger: { opponentHpBelow: 40 },
        opponentLine: "You're right. It's been bad. I've been going through something but that's not your problem. I'll get it together.",
      },
    ],
  },

  roommate_drama_perfectionist: {
    intro: "Sarah has a system. A labeling system, a rotation schedule, a cleaning protocol with zones. You didn't follow it. Twice. Now there's a typed note on the refrigerator addressed to you.",
    opponentBarks: {
      confident: "I just think if we're both committed to a functional living environment, the system makes that effortless. It's not complicated.",
    },
    opponentReacts: {
      confident: {
        empathy: "I know it seems excessive. It helps me feel like things aren't falling apart. The apartment is the one thing I can actually control.",
        logic: "You're right that not everyone uses the same system. But can we agree on shared standards?",
        cunning: "If you propose a simpler version, I'd genuinely consider it. I just need something.",
        aggression: "I'm not unreasonable. I just... I need order. I don't know how to explain it without sounding unwell.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Sarah, I'm not dismissing the system. I want to understand what it does for you — because it matters to you, it matters to me.",
        logic: "Can we agree on the three non-negotiables and leave the rest flexible? I'll commit to three.",
        cunning: "What if we made a simpler shared version — just the things that affect both of us? And I opt into it voluntarily?",
        aggression: "A typed note on the fridge is passive-aggressive. If something bothers you, you can say it to me directly.",
      },
      athlete: {
        logic: "Tell me the three things that matter most and I'll do those. Not twenty. Three.",
        empathy: "What happens in your head when the apartment feels out of control? I actually want to know.",
        aggression: "A note on the fridge. Really. You couldn't just knock on my door?",
      },
      artist: {
        empathy: "I can feel how much energy you put into creating order here. That must be exhausting to do alone.",
        cunning: "What if we made the system something we both designed together? Then I'm invested in it too.",
      },
    },
    beats: [
      {
        id: 'sarah_history',
        trigger: { round: 3 },
        opponentLine: "My last roommate was chaos. Complete chaos. I came home to flooded floors twice. I'm just — I'm trying to prevent that.",
      },
      {
        id: 'sarah_softens',
        trigger: { opponentHpBelow: 35 },
        opponentLine: "I know I'm a lot to live with. I know that. I'm working on it.",
      },
    ],
  },

  roommate_drama_hothead: {
    intro: "Marcus slams the door. He yells at his games. He brought three people over at midnight with no warning. When you said something, he told you to 'lighten up.' The lease is in both names.",
    opponentBarks: {
      annoyed: "Here we go. Another lecture. Go ahead.",
    },
    opponentReacts: {
      annoyed: {
        empathy: "...I'm not used to people actually asking instead of just complaining. What do you want me to say?",
        logic: "Fine. I'll put the gaming to headphones after midnight. Happy?",
        aggression: "I pay rent here too. You don't get to set the rules.",
        cunning: "You're offering me something? That's new. What's the trade?",
      },
      angry: {
        empathy: "Why do you keep doing that — the calm voice thing? It makes me feel like I'm being managed.",
        aggression: "Then we have a problem, don't we.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Marcus, I'm not here to tell you how to live. I'm here because I genuinely can't sleep, and I need your help with that.",
        logic: "Midnight noise violates our lease agreement — it's in section three. I'd rather not involve the landlord.",
        aggression: "I've been patient. This is me being done with patient.",
        cunning: "What if you get the living room for gaming until 11, and I get quiet hours after? We both have something.",
      },
      athlete: {
        empathy: "I'm not attacking you. I'm asking you to hear me out. One minute.",
        logic: "Headphones after midnight. That's the whole ask.",
        aggression: "Three people. Midnight. No heads-up. That can't keep happening.",
      },
      artist: {
        empathy: "Something's been eating you for weeks. The noise, the people — I don't think it's about the apartment at all.",
        cunning: "Here's an idea: you get one unannounced guest pass per month. I get one veto. We're both protected.",
      },
    },
    beats: [
      {
        id: 'marcus_gaming_context',
        trigger: { round: 2 },
        narrative: "Through the wall you can still hear the game running. He forgot to pause it.",
      },
      {
        id: 'marcus_real_issue',
        trigger: { opponentHpBelow: 30 },
        opponentLine: "I've been getting eviction notices at my old place forwarded here. I don't want to think about quiet. When it's quiet I think about it.",
      },
    ],
  },

  roommate_drama_manipulator: {
    intro: "Over six months, Alex has managed to get you to pay for groceries 'temporarily,' give up the bigger room 'just while they're between jobs,' and take on two-thirds of the cleaning. They always have a reason. Tonight you're done having reasons.",
    opponentBarks: {
      confident: "I just feel like we've had such a good thing going here. I'd hate for a misunderstanding to disrupt that.",
    },
    opponentReacts: {
      confident: {
        cunning: "You've done your homework. I respect that. What's your actual ask?",
        logic: "You're right that the arrangement has drifted. I can acknowledge that.",
        empathy: "I hear that you've been feeling taken advantage of. I genuinely didn't see it that way.",
        aggression: "Let's not make this ugly. We can work this out like adults.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Alex, I don't think you're a bad person. I think you're very good at making arrangements that favor you. I'd like to reset.",
        logic: "I've tracked the grocery bills, the cleaning hours, and the room arrangement. I have three months of receipts.",
        cunning: "Here's what fair looks like going forward — I've written it up. You can suggest edits but the math is the math.",
        aggression: "The temporary arrangements became permanent. This month, that changes.",
      },
      athlete: {
        logic: "Rent is split 50-50. Groceries are split 50-50. Cleaning is split 50-50. Effective immediately.",
        aggression: "You've been running the same play for six months. I figured it out. It stops tonight.",
        cunning: "I'm giving you a chance to course-correct before this becomes a much harder conversation.",
      },
      artist: {
        empathy: "I've been asking myself — does Alex know what they're doing? Because if you don't, I want to tell you. If you do, I want to know why.",
        logic: "Every 'temporary' arrangement is still in place. That's not temporary anymore. That's just how we live.",
        cunning: "I've drafted a roommate agreement. I'd like us both to sign it. If you won't, I'll know what that means.",
      },
    },
    beats: [
      {
        id: 'alex_deflect',
        trigger: { round: 2 },
        opponentLine: "I want you to know, I've always thought of you as a real partner in this apartment. Not just a roommate.",
      },
      {
        id: 'alex_cornered',
        trigger: { opponentHpBelow: 30 },
        opponentLine: "Okay. Real talk? I've been coasting. I know it. Tell me what the rebalance looks like.",
      },
    ],
  },

  roommate_drama_anxious: {
    intro: "Emma has left dirty dishes everywhere, played music at odd hours, and let strangers through the front door. When you try to bring it up she apologizes so intensely that the conversation collapses. You need this to actually land.",
    opponentBarks: {
      vulnerable: "I know. I know, I know, I know. I'm a disaster. Please don't be mad. I'll understand if you want me to move out.",
    },
    opponentReacts: {
      vulnerable: {
        empathy: "Thank you for not — I thought you'd just hand me a lease notice. I've been pretending everything's fine and it's really not.",
        logic: "A chore chart? That's so... normal. Yeah. Yeah, let's try that. I think I need the structure.",
        aggression: "Please don't yell. I know I deserve it but I can't do a fight right now.",
        cunning: "I guess you're right. I don't have better ideas. I'll try it your way.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Emma, I'm not asking you to move out. I'm asking if we can find something that works for both of us.",
        logic: "Let's write it down. Simple rules, clear expectations. Nothing punitive — just a framework.",
        aggression: "I need you to stop apologizing and actually commit to something.",
        cunning: "What if we started with just the kitchen? One room. Build from there.",
      },
      athlete: {
        empathy: "Hey. Look at me. You're not a disaster. You're struggling. There's a difference.",
        logic: "I need the dishes done within twenty-four hours. That's the only rule that matters to me.",
        aggression: "The strangers through the door — that's a safety issue, Emma. I need that to stop.",
      },
      artist: {
        empathy: "I can feel how much weight you're carrying. This isn't really about the dishes, is it?",
        logic: "What if we made one small agreement — just one — and built trust from there?",
        cunning: "What if we both shared what we need from the apartment and designed the rules from that? No defaults.",
      },
    },
    beats: [
      {
        id: 'emma_context',
        trigger: { round: 3 },
        opponentLine: "I haven't been sleeping. Since October. I know that's not an excuse. I just want you to understand what you're looking at.",
      },
      {
        id: 'emma_commit',
        trigger: { opponentHpBelow: 30 },
        opponentLine: "Can we write the chart right now? Tonight? I want to do it while I still feel like I can.",
      },
    ],
  },

  // ────── WORKPLACE CONFLICT ──────

  workplace_conflict_slacker: {
    intro: "Jake is technically your peer but hasn't shipped a deliverable in six weeks. The team covers for him. Your director hasn't noticed — yet. You need Jake to produce something before the next review or everyone looks bad.",
    opponentBarks: {
      lazy: "I've been heads-down on some background stuff. It's not visible yet but it's coming together.",
    },
    opponentReacts: {
      lazy: {
        empathy: "Honestly? I've been phoning it in. I don't know when it started. I don't even care about this project.",
        logic: "If I can just get something shipped by Thursday, that would probably fix it, right?",
        aggression: "You're not my manager. This isn't your call.",
        cunning: "You'd cover the presentation if I finish the backend? That's actually helpful.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Jake, I'm not reporting you. I'm asking because I need to understand what's going on so I can actually help.",
        logic: "One deliverable. By Thursday. I'll help you scope it down to something achievable.",
        aggression: "The team is covering for you. That ends when the director starts asking. Which is next week.",
        cunning: "Ship one thing this week — anything. I'll present it so your name is on something visible.",
      },
      athlete: {
        empathy: "You're checked out. I can see it. What's going on?",
        logic: "One thing. By Thursday. Can you commit to that?",
        aggression: "The team is taking hits for you. I'm done doing that.",
      },
      artist: {
        empathy: "You used to care about this work. Something changed. What happened?",
        cunning: "What if you pick the part that feels most interesting to you and just do that? Sometimes momentum is just starting.",
      },
    },
    beats: [
      {
        id: 'jake_honest',
        trigger: { round: 3 },
        opponentLine: "I took this job because it paid well. I thought I'd grow into caring about it. I never did.",
      },
      {
        id: 'jake_commits',
        trigger: { opponentHpBelow: 35 },
        opponentLine: "Fine. I'll do the API documentation. Nobody wants to do it and it's in my backlog. I'll have it by Thursday.",
      },
    ],
  },

  workplace_conflict_perfectionist: {
    intro: "Sarah keeps flagging your work for 'quality concerns' before it even gets reviewed — in shared Slack channels, visible to the whole team. You're not getting feedback. You're getting undermined.",
    opponentBarks: {
      confident: "I just think the bar should be consistent for everyone. I flag my own work too — I hold myself to the same standard.",
    },
    opponentReacts: {
      confident: {
        empathy: "I didn't realize it came across that way. I thought I was being helpful. I genuinely did.",
        logic: "If the feedback is valid — and I believe it is — does the channel really matter?",
        cunning: "You're saying the effect is the same even if the intent is different. I... yes. I see that.",
        aggression: "I'm not trying to undermine you. I'm trying to keep quality high.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Sarah, I want to understand — is this about the work, or is there something about working with me that isn't landing right?",
        logic: "Direct feedback before submission: yes. Public flags on shared channels before review: that's a different thing.",
        cunning: "What if we agreed on a feedback loop — just between us — before either of us flags things publicly?",
        aggression: "Flag my work in a private message or don't flag it at all.",
      },
      athlete: {
        logic: "Private feedback or public feedback — those have different effects. I need you to understand that.",
        aggression: "The public channel posts stop. That's non-negotiable.",
        cunning: "DM me first. Give me one day to respond. If you don't hear back, escalate. That's fair.",
      },
      artist: {
        empathy: "I'm wondering if there's a dynamic between us that I haven't understood yet. Can we talk about that?",
        logic: "The work gets better with feedback. The team dynamic gets worse with public friction. We can have one without the other.",
        cunning: "What if we set up a pre-review sync, just us, before anything goes to the channel? Keeps quality up and keeps it clean.",
      },
    },
    beats: [
      {
        id: 'sarah_context',
        trigger: { round: 3 },
        opponentLine: "At my last job someone shipped broken code to production without telling anyone and we lost a client. I know that's not the same. But I'm terrified of things going out wrong.",
      },
      {
        id: 'sarah_concedes',
        trigger: { opponentHpBelow: 35 },
        opponentLine: "I'll move it to DMs. I can do that. I'm sorry I didn't think about how it landed.",
      },
    ],
  },

  workplace_conflict_hothead: {
    intro: "Marcus confronted you in the hallway this morning — said you 'threw him under the bus' in last week's meeting. You didn't. You stated a fact. He's been stewing for a week and now he wants a fight.",
    opponentBarks: {
      annoyed: "You know exactly what you did. Don't play innocent.",
    },
    opponentReacts: {
      annoyed: {
        empathy: "...you actually don't know what I'm talking about, do you. Or you're a really good actor.",
        logic: "The timeline comment. You implied the delay was my team's fault. In front of Reeves.",
        aggression: "Then say it to my face. Right here.",
        cunning: "What are you offering?",
      },
      angry: {
        empathy: "This is the wrong moment. You can't reason with me right now. Give me an hour.",
        logic: "I know what I heard. I know what it looked like to Reeves.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Marcus, I hear that you're angry. Walk me through what you think happened — I want to understand it from your side.",
        logic: "I stated the delivery date from the tracker. That's public data. If it caused a problem, I want to understand how.",
        aggression: "You confronted me in a hallway. In front of people. I didn't do that to you.",
        cunning: "If the read was wrong, let's correct it — together, to Reeves. I'll go with you.",
      },
      athlete: {
        empathy: "Talk to me. Not in a hallway. Not like this. Actually talk to me.",
        logic: "I used the data from the shared tracker. Same data you have access to.",
        aggression: "Then we disagree on what happened. We can take it to Reeves and let her sort it out.",
      },
      artist: {
        empathy: "You wouldn't be this angry if it didn't matter to you. What does this situation actually feel like from the inside?",
        cunning: "Here's a thought: we go to Reeves together, you walk through your team's timeline, I back it up. The narrative resets.",
      },
    },
    beats: [
      {
        id: 'marcus_real_fear',
        trigger: { round: 3 },
        opponentLine: "I'm up for team lead review next month. If Reeves thinks I can't manage a deadline, that's over.",
      },
      {
        id: 'marcus_backs_down',
        trigger: { opponentHpBelow: 30 },
        opponentLine: "...I shouldn't have done this in the hallway. That was wrong. Can we find a room?",
      },
    ],
  },

  workplace_conflict_manipulator: {
    intro: "Alex has been repeating your ideas in meetings and pitching them as their own. Three times this quarter. The Q3 pitch landed your director's praise — on Alex's name. Promotion decisions go in on Monday. Alex just pinged you: 'got a sec?'",
    opponentBarks: {
      confident: "Hey! So glad you caught me. Look — I wanted to get ahead of any weirdness about the Q3 pitch. I know it landed well.",
    },
    opponentReacts: {
      confident: {
        cunning: "...you're really not going to let me finish that sentence, are you.",
        logic: "Okay. You have receipts. What do you actually want — an email to the director, or me withdrawing from consideration?",
        manipulation: "Interesting pivot. I respect the play. Let's talk about what works for both of us.",
        aggression: "You going to escalate this? Because I have a counter-narrative ready and you should know that.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Alex, I'm not here to destroy you. I'm here because three times is a pattern, and I need it to stop.",
        logic: "The original proposal is in my sent folder, timestamped three days before your pitch. I have the thread.",
        cunning: "Here's what I want: an email to Reeves crediting the origination, and we never have this conversation again.",
        aggression: "I want public credit. By Monday. Or I send Reeves the timestamp chain.",
      },
      athlete: {
        logic: "Timestamped email. Sent folder. Three days before your pitch. I have it open right now.",
        aggression: "The promotion can go to whoever Reeves wants — but she's going to know where the idea came from first.",
        cunning: "Credit me in the all-hands recap on Friday. That's the deal. Take it or leave it.",
      },
      artist: {
        empathy: "I want to ask you something honestly — do you know you do this? Or does it happen without realizing?",
        logic: "There's a document trail that tells this story clearly. I'd like you to read it.",
        cunning: "What if you proactively credited me in the recap email? Shows integrity, fixes the record, costs you nothing.",
      },
    },
    beats: [
      {
        id: 'alex_charm',
        trigger: { round: 2 },
        opponentLine: "You're one of the sharpest people on this team. That's not flattery — I actually believe it. That's why I brought you in on this.",
      },
      {
        id: 'alex_cornered',
        trigger: { opponentHpBelow: 30 },
        opponentLine: "I'll send the email. Tonight. Credit where it's due. I'd rather do that than go to the mat on this.",
      },
    ],
  },

  workplace_conflict_anxious: {
    intro: "Emma accidentally CC'd a competitor on an email that had your project roadmap attached. She didn't realize for three days. When she told you, she was crying. Now you have to figure out what to do — and Emma is barely functional.",
    opponentBarks: {
      vulnerable: "I've been going over it a thousand times. I don't know how I missed it. I'm so sorry. I understand if you have to report it.",
    },
    opponentReacts: {
      vulnerable: {
        empathy: "You're not going straight to HR? I've been awake for two days waiting for that call.",
        logic: "If we can contain it — just us, the director, and the legal team — I think I can explain it without losing my job. Maybe.",
        aggression: "I know. You're right. Whatever you decide. I'll accept it.",
        cunning: "That could work. You really think that could work? What do I say to Reeves?",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Emma, I need you to be here for this conversation. I know you're scared. But I need you to be here.",
        logic: "Here's what we know: they received the attachment, we don't know if they opened it. We have a window. Let's use it.",
        cunning: "I have a plan to contain this. You'll have to be honest with Reeves — all of it. Can you do that?",
        aggression: "What you need to do right now is stop spiraling and tell me exactly what was in that attachment.",
      },
      athlete: {
        empathy: "Hey. Breathe. You made a mistake. We're going to fix it. But I need you present.",
        logic: "One question: has anyone from their side confirmed they read it?",
        cunning: "We report it before they can use it. Proactive disclosure changes the legal calculus. Are you in?",
      },
      artist: {
        empathy: "I'm not angry. I'm worried about you, and I'm worried about the situation. Let's handle the situation first.",
        logic: "We have forty-eight hours before this could become public. What do we know about what they received?",
        cunning: "The story we bring to Reeves matters. Let me help you frame it so it's honest but also shows you caught it.",
      },
    },
    beats: [
      {
        id: 'emma_detail',
        trigger: { round: 2 },
        opponentLine: "The roadmap had the Q2 pricing model attached. And the client list. It was the full deck.",
      },
      {
        id: 'emma_steadies',
        trigger: { opponentHpBelow: 35 },
        opponentLine: "Okay. I'm ready. Tell me what to say to Reeves. I'll do it right now while I still can.",
      },
    ],
  },

  // ────── FAMILY DINNER ──────

  family_dinner_slacker: {
    intro: "Jake is your family's great unfulfilled potential. Twenty-six. Living at home. Barely employed. Every dinner becomes a group effort to not say what everyone is thinking — except you're sitting right next to him and you're finally out of patience.",
    opponentBarks: {
      lazy: "I'm figuring it out. I just need a little more time to find the right thing, you know?",
    },
    opponentReacts: {
      lazy: {
        empathy: "It's just... every option feels wrong. I don't want to settle for something I'll hate for thirty years.",
        logic: "I know I need to do something. I just get paralyzed when I think about where to start.",
        aggression: "You're not my parent. You don't need to do this at dinner.",
        cunning: "Starting with one application. Just one. That's actually a manageable thing.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Jake, I'm not going to pile on. I'm asking because I actually want to know — what does the right thing look like to you?",
        logic: "Pick one thing you want to try. One application. You can refine from there.",
        aggression: "You've been 'figuring it out' for two years. At some point that becomes the answer.",
        cunning: "What if you gave yourself ninety days? A deadline. Not pressure — just a container.",
      },
      athlete: {
        empathy: "What do you actually want? Not what anyone expects. What do you want?",
        logic: "One thing. Just pick one and commit to it for ninety days. See what happens.",
        aggression: "You're not waiting for the right thing. You're waiting for it to feel safe. It doesn't work that way.",
      },
      artist: {
        empathy: "The paralysis you're describing — I've felt that. It's not laziness. But it doesn't fix itself either. What would help?",
        cunning: "What if you didn't have to decide everything — just the next step? What's the smallest possible next step?",
      },
    },
    beats: [
      {
        id: 'table_pressure',
        trigger: { round: 2 },
        narrative: "Your aunt opens her mouth to say something and then doesn't. The silence is its own kind of sound.",
      },
      {
        id: 'jake_honest',
        trigger: { opponentHpBelow: 40 },
        opponentLine: "I'm scared it's too late. That I waited too long and the window closed while I was thinking about it.",
      },
    ],
  },

  family_dinner_perfectionist: {
    intro: "Sarah is your family's golden standard — the one with the plan, the metrics, the five-year trajectory. Tonight she's been critiquing your food choices, your posture, and your 'lack of direction' for forty minutes. The family is letting her go.",
    opponentBarks: {
      confident: "I'm just saying, there's a more optimized path available to you. I've looked at the research.",
    },
    opponentReacts: {
      confident: {
        empathy: "I care about you. That's why I say things. I don't know how to express it without it coming out as advice.",
        logic: "You're right that unsolicited optimization is just criticism. I knew that. I keep forgetting it.",
        cunning: "If I ask first, and you opt in — I can do that. I just need the signal.",
        aggression: "I didn't realize it felt like an attack. I thought it felt like caring.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Sarah, I know you're coming from a place of care. But right now it's landing as a performance review. Can you feel the difference?",
        logic: "I didn't ask for feedback on my choices tonight. That's the part I need you to hear.",
        cunning: "What if you asked before you weighed in? Just — 'do you want my take on this?' I'd probably say yes sometimes.",
        aggression: "This is a dinner table. Not a performance review. Can we eat?",
      },
      athlete: {
        empathy: "Hey. I know you mean well. But you've been going for forty minutes and I'm getting a little buried here.",
        logic: "I didn't ask. That matters.",
        aggression: "Enough. I'm serious.",
      },
      artist: {
        empathy: "The care is real. I know that. But the delivery is... a lot. Can we find a way to get the love without the assessment?",
        cunning: "What if I asked you questions when I want input? And you trusted that I'd ask?",
      },
    },
    beats: [
      {
        id: 'family_watches',
        trigger: { round: 2 },
        narrative: "Your mother is refilling everyone's water. Your father is very interested in his food. The whole table is watching.",
      },
      {
        id: 'sarah_softens',
        trigger: { opponentHpBelow: 35 },
        opponentLine: "I think I do this when I'm anxious. I make things into projects. I'm sorry.",
      },
    ],
  },

  family_dinner_hothead: {
    intro: "Marcus has been 'just asking questions' about your job, your partner, and your weight for forty minutes. Mom is pretending not to hear. Dad is eating. Everyone's waiting to see if you'll handle it.",
    opponentBarks: {
      annoyed: "I'm just saying what everyone's thinking. It's not my fault nobody else has the guts to bring it up.",
    },
    opponentReacts: {
      annoyed: {
        empathy: "...don't do that. Don't therapist-voice me at the dinner table. I hate that.",
        aggression: "Oh, finally. There you are. I was wondering how long you'd keep playing nice.",
        logic: "You want to debate? Fine. Defend your choices. What's your five-year plan?",
        cunning: "What angle are you playing?",
      },
      guilty: {
        empathy: "I'm not — I didn't come here to be the villain. I just get going and I can't stop.",
        aggression: "Don't make me the bad guy for saying the things no one else will say.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Marcus, I'm not angry. I'm asking — what are you actually looking for here? Because this doesn't feel like curiosity.",
        logic: "You've asked about my job, my partner, and my weight. None of those are your business. I'm letting you know.",
        aggression: "I'm done deflecting it. You've been picking at me for an hour. Say what you actually mean.",
        cunning: "What if we made a deal: you tell me what's actually bothering you, and I'll engage with that instead.",
      },
      athlete: {
        empathy: "Something's eating you tonight. This isn't about me.",
        logic: "You're going to need a different strategy. This one isn't working.",
        aggression: "That's the last one. I mean it.",
        cunning: "You want a real conversation? I'm in. Not this performance — a real one. You willing?",
      },
      artist: {
        empathy: "There's something underneath all this noise. I can feel it. What's really going on with you tonight?",
        cunning: "What if we stepped outside for a minute? Just us. Real talk.",
        aggression: "I'm not going to sit here and absorb this all night.",
      },
    },
    beats: [
      {
        id: 'table_tension',
        trigger: { round: 2 },
        narrative: "Your mother refills the bread basket. She doesn't look up.",
      },
      {
        id: 'marcus_real',
        trigger: { opponentHpBelow: 35 },
        opponentLine: "...I got laid off three weeks ago. I haven't told anyone here. Picking at you is easier than sitting with it.",
      },
    ],
  },

  family_dinner_manipulator: {
    intro: "Alex is the family member who's always the victim, always the most misunderstood, always the one being unfairly treated — and somehow, by the end of every dinner, you're apologizing to them. Tonight you decided that stops.",
    opponentBarks: {
      confident: "I just think family should be a safe space. I've never felt like I could be honest here without it being turned back on me.",
    },
    opponentReacts: {
      confident: {
        cunning: "You practiced this. That's... actually impressive.",
        empathy: "I know I make things complicated. I know how I come across. It's not how I feel inside.",
        logic: "You're treating me like a problem to be solved. I'm a person.",
        aggression: "Is this really what we're doing at dinner? Really?",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Alex, I don't want to fight. But I've noticed that somehow every family conversation ends with the rest of us explaining ourselves to you. I want to talk about that.",
        logic: "The last three dinners, I've gone home feeling like I'd done something wrong. I need to understand how that keeps happening.",
        cunning: "I'm not going to escalate tonight. I'm just going to name the pattern and let you sit with it.",
        aggression: "I'm done being managed. I want a real conversation.",
      },
      athlete: {
        empathy: "I want to hear from you — actually hear from you. Not the version of this where we all end up apologizing.",
        logic: "You're describing yourself as a victim of this family. I'd like to compare notes on that.",
        cunning: "Let's try something: we each say one true thing about tonight. Just one. I'll go first.",
      },
      artist: {
        empathy: "I believe you feel unseen here. I want to actually see you — which means I need to say what I'm seeing too.",
        cunning: "What if we didn't do the usual dance tonight? I'm genuinely curious what would come out.",
      },
    },
    beats: [
      {
        id: 'family_sides',
        trigger: { round: 3 },
        narrative: "Your aunt makes a small sound of support for Alex. The table is not neutral.",
      },
      {
        id: 'alex_drops_guard',
        trigger: { opponentHpBelow: 30 },
        opponentLine: "I don't know how to not be the problem. I've been the problem in this family for so long I don't know what else I am.",
      },
    ],
  },

  family_dinner_anxious: {
    intro: "Emma is your family member who's been spiraling quietly all evening — the one picking at her food, giving short answers, bracing for something. Your grandmother keeps poking at her about her boyfriend and her 'future.' Emma looks like she might break.",
    opponentBarks: {
      vulnerable: "I'm fine. I'm fine, really. Can we just — can we talk about something else?",
    },
    opponentReacts: {
      vulnerable: {
        empathy: "I'm not fine. But I can't do this at the table. I can't.",
        logic: "You're right. I don't have to answer questions I don't want to answer. I keep forgetting that.",
        cunning: "Yes. Yes, I'll follow your lead. Please.",
        aggression: "Please don't make it worse. Please.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Emma. Hey. You don't have to answer any of that. I've got you.",
        logic: "Grandma, Emma has it handled. Let's give her some space to eat.",
        cunning: "Let's change the subject — Emma, tell me about the trip you mentioned last week.",
        aggression: "That's enough questions for now. Let her breathe.",
      },
      athlete: {
        empathy: "Emma. Eyes here. You okay?",
        cunning: "Hey — I need help with something in the kitchen. Emma, come with me for a sec.",
        aggression: "Grandma. She said she's fine. Let it go.",
      },
      artist: {
        empathy: "I can feel what you're going through from across the table. Let me help redirect this.",
        cunning: "Emma, tell everyone what you told me about your project last week — the good news.",
      },
    },
    beats: [
      {
        id: 'grandma_continues',
        trigger: { round: 2 },
        narrative: "Your grandmother asks again — a slightly different angle, a little softer, still relentless.",
      },
      {
        id: 'emma_grateful',
        trigger: { opponentHpBelow: 35 },
        opponentLine: "Thank you for doing that. I couldn't — I've been freezing every time she does it. Thank you.",
      },
    ],
  },

  // ────── RESOURCE COMPETITION ──────

  resource_competition_slacker: {
    intro: "Jake is in the study room. Has been for three hours. He's on his laptop watching something with one earbud in. You have a final exam tomorrow morning. This is the only quiet room left.",
    opponentBarks: {
      lazy: "Oh. Yeah, I've got this reserved through seven. Technically.",
    },
    opponentReacts: {
      lazy: {
        empathy: "Finals? That does sound rough. Look, I only actually need it until five. I could be out by then.",
        logic: "If you've got an exam tomorrow, yeah, that's a higher priority. I'm just doing some reading.",
        aggression: "Okay, fine. You can have it at five. But you're welcome.",
        cunning: "One condition — you buy me a coffee from the cart outside. Deal.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Jake, I can see you're set up here. I have a final at 8 AM tomorrow. Is there any flexibility?",
        logic: "I'll be honest — the reservation system isn't great. But I have a real exam tomorrow. Can we work something out?",
        aggression: "You're watching Netflix. I have a final exam.",
        cunning: "What if you take the first two hours and I take the last two? We both get it, I get the quiet stretch I need most.",
      },
      athlete: {
        empathy: "Finals week. Exam at 8. I'm asking as one person to another.",
        logic: "Your reservation was for two hours. You've had three. I'm just asking for the rest.",
        aggression: "You're watching a show. I'm studying. Come on.",
      },
      artist: {
        empathy: "I know you got here first. I'm not trying to take anything from you. I'm just really stuck.",
        cunning: "What if we split it — you take the front half, I take the back half, and we set a phone alarm so nobody has to track it?",
      },
    },
    beats: [
      {
        id: 'jake_softens',
        trigger: { round: 3 },
        narrative: "Jake pauses his video. He actually looks at you for the first time.",
      },
      {
        id: 'jake_yields',
        trigger: { opponentHpBelow: 35 },
        opponentLine: "Honestly, I was going to leave soon anyway. Go ahead. Just bring the vibe down a little first.",
      },
    ],
  },

  resource_competition_perfectionist: {
    intro: "Sarah has the study room booked from 3 to 5, color-coded in her planner. You have it booked from 3 to 5, confirmed via email. The room booking system double-assigned it. You both arrive at the same time.",
    opponentBarks: {
      confident: "I confirmed this booking two days ago. I have the confirmation email right here.",
    },
    opponentReacts: {
      confident: {
        empathy: "I know you're not trying to be difficult. I'm just — I have a system and this breaks the system.",
        logic: "If we both have confirmation emails, the error is on the system side. We should report it and find a solution.",
        cunning: "You'd share it? Actually share it? I could work with dividers — I could make that work.",
        aggression: "I don't want to argue about this. I want to study.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Sarah, we both got legitimately screwed by the booking system. Neither of us is wrong here. What can we figure out?",
        logic: "We both have confirmation emails. The system failed. The solution isn't who wins — it's what works for both of us in the next two hours.",
        cunning: "What if we split the room — you take the left side, I take the right, we agree on silence? We both lose a little space but keep the time.",
        aggression: "We could go back and forth on this or we could both just start studying. I know which one I prefer.",
      },
      athlete: {
        empathy: "This is a system problem, not a people problem. Let's not make it a people problem.",
        logic: "The room fits two people. We both have the same two hours. Why not just share it?",
        cunning: "You take the desk by the window, I take the one by the door. Headphones on, we never have to interact.",
      },
      artist: {
        empathy: "I know this disrupts your plan. I can see that. What would make this feel okay?",
        cunning: "What if we just coexist in here — you have your half, I have mine, we both win?",
      },
    },
    beats: [
      {
        id: 'both_pull_emails',
        trigger: { round: 2 },
        narrative: "You both have your phones out. Both emails show 3:00–5:00, Room 204. The booking system is definitively broken.",
      },
      {
        id: 'sarah_concedes',
        trigger: { opponentHpBelow: 35 },
        opponentLine: "Okay. Shared room, maintained silence, no interruptions. I can adapt the plan.",
      },
    ],
  },

  resource_competition_hothead: {
    intro: "Marcus got here first and he's not moving. When you showed him your reservation he said 'first come, first served' and put his headphones back on. You've got a final tomorrow. The library closes in two hours.",
    opponentBarks: {
      annoyed: "I'm already set up. Find another room.",
    },
    opponentReacts: {
      annoyed: {
        empathy: "I heard you. I'm not heartless. It's just — I've been here an hour and I'm finally in the zone.",
        logic: "You reserved it? Show me.",
        aggression: "You want to escalate this over a study room? That's where we're at?",
        cunning: "What's the split?",
      },
      angry: {
        empathy: "I'm just trying to study. I'm not trying to ruin your night.",
        aggression: "Then we get the librarian. Let's go.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "I get that you're in the zone. I'm not here to derail you — I genuinely need a quiet place for tomorrow's exam.",
        logic: "I have a reservation for this room. That's not opinion, that's a confirmation email.",
        aggression: "You can fight this or we can both just get back to studying. The room fits two people.",
        cunning: "I'll study at the back table and you keep the desk. We both have what we actually need.",
      },
      athlete: {
        empathy: "Hey. I know it's annoying. Final tomorrow morning. I just need somewhere quiet.",
        logic: "Reservation, 3 to 5, this room. I'm not making it up.",
        aggression: "I'll get the librarian. Or we share the room. Your call.",
      },
      artist: {
        empathy: "You clearly needed this space too. I'm not your enemy here. What would actually work for you?",
        cunning: "What if you stay set up where you are and I take the far corner? We'd barely know the other exists.",
      },
    },
    beats: [
      {
        id: 'marcus_clock',
        trigger: { round: 3 },
        narrative: "Marcus glances at the clock. He's been here longer than he meant to.",
      },
      {
        id: 'marcus_budges',
        trigger: { opponentHpBelow: 35 },
        opponentLine: "Fine. Back table is yours. Don't talk to me.",
      },
    ],
  },

  resource_competition_manipulator: {
    intro: "Alex reserved the room, doesn't need it, and has been deflecting your requests for twenty minutes — offering vague 'maybe laters' while using the room for a personal phone call. You're running out of time.",
    opponentBarks: {
      confident: "I totally understand your situation. I just have one more call and then I might be heading out.",
    },
    opponentReacts: {
      confident: {
        cunning: "You're better at this than I expected. What do you actually want?",
        logic: "I appreciate the clarity. I'll wrap up by 4:30.",
        empathy: "I hear you. Final tomorrow, legitimately need this. I'll take my call outside.",
        aggression: "No need to make it a whole thing. I'll be out shortly.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Alex, I don't want to be adversarial here. But 'shortly' has been 'shortly' for twenty minutes.",
        logic: "I have a reservation for 4:00. It's 4:10. I need a time — a specific time.",
        cunning: "Here's what I can offer: I won't mention this to the front desk if you're out by 4:15. That's the trade.",
        aggression: "I need the room. The room I reserved. I'm going to get the librarian.",
      },
      athlete: {
        logic: "4:15. Hard stop. Can you commit to that?",
        aggression: "I'm going to the front desk if I don't have the room in five minutes.",
        cunning: "One call, outside, room is mine. Simple deal. Yes or no.",
      },
      artist: {
        empathy: "I can see you're in the middle of something. I genuinely need to know when 'shortly' is.",
        cunning: "What if you moved your call to the hallway and I studied quietly in here? We'd both have what we need.",
      },
    },
    beats: [
      {
        id: 'alex_stall',
        trigger: { round: 2 },
        opponentLine: "You know what, give me just two more minutes — this call is wrapping up. Seriously, two minutes.",
      },
      {
        id: 'alex_yields',
        trigger: { opponentHpBelow: 30 },
        opponentLine: "Okay. You got me. I'll take it to the hallway. Room's yours.",
      },
    ],
  },

  resource_competition_anxious: {
    intro: "Emma reserved this room six weeks ago. She's set up, organized, ready. She also looks like she's about to offer to leave before you even finish your sentence. You both have legitimate claims. You need to actually talk to her.",
    opponentBarks: {
      vulnerable: "Oh — you need it too? I'm so sorry. I should probably just — I mean, I could find somewhere else.",
    },
    opponentReacts: {
      vulnerable: {
        empathy: "You don't want me to leave? Most people would just... take the room.",
        logic: "Sharing is actually — that's a good idea. I didn't even think of that. I just assumed I had to go.",
        cunning: "You're really okay with that? Okay. Yeah. That's... thank you.",
        aggression: "Oh — no, no, it's fine. Please, take it. Really.",
      },
    },
    playerLines: {
      scholar: {
        empathy: "Emma, I'm not here to take your room. You reserved it, you're set up — I want to figure out what's fair.",
        logic: "We both have reservations. The room fits two people. What if we just both stayed?",
        cunning: "You take the desk you're at, I take the one across. Neither of us has to lose anything.",
        aggression: "Please stop offering to leave. I don't want you to leave. I want to figure this out.",
      },
      athlete: {
        empathy: "Hey. Breathe. Nobody's taking anything from you. Can we just talk for a second?",
        logic: "You were here first. I have a reservation too. Room fits two. Easy math.",
        cunning: "Stay where you are. I'll take the other desk. Done deal.",
      },
      artist: {
        empathy: "I notice you immediately offered to leave. I'm not going to let you do that — you earned this room.",
        cunning: "What if we both stayed, set up our spaces, and neither of us mentions it again?",
      },
    },
    beats: [
      {
        id: 'emma_about_to_pack',
        trigger: { round: 2 },
        narrative: "Emma is already closing her notebook. She's ready to leave before you've even asked her to.",
      },
      {
        id: 'emma_relieved',
        trigger: { opponentHpBelow: 35 },
        opponentLine: "I've been moving out of rooms my whole life because I thought that's what I was supposed to do. Thank you for not making me do that.",
      },
    ],
  },
};

// ============================================================
// OBJECTIVES
// ============================================================

export const CONFLICT_OBJECTIVES: Record<string, Objective[]> = {
  group_project: [
    { id: 'win', label: 'Resolve the situation', check: s => s.isVictory },
    { id: 'no_aggression', label: "Don't use Aggression", check: s => count(s, 'aggression') === 0 },
    { id: 'under_6', label: 'Finish in 6 turns or fewer', check: s => s.turns <= 6 && s.isVictory },
  ],
  roommate_drama: [
    { id: 'win', label: 'De-escalate the conflict', check: s => s.isVictory },
    { id: 'no_manip', label: 'Stay honest — no Manipulation', check: s => count(s, 'manipulation') === 0 },
    { id: 'trust_ending', label: 'Leave them trusting you', check: s => s.isVictory && ['trusting','grateful','vulnerable'].includes(s.finalOpponentEmotion) },
  ],
  workplace_conflict: [
    { id: 'win', label: 'Hold your ground', check: s => s.isVictory },
    { id: 'expose', label: 'Use Cunning and Logic both', check: s => count(s, 'cunning') >= 1 && count(s, 'logic') >= 1 },
    { id: 'clean', label: 'Finish above 50 HP', check: s => s.isVictory && s.finalPlayerHp >= 50 },
  ],
  family_dinner: [
    { id: 'win', label: 'End the tension', check: s => s.isVictory },
    { id: 'graceful', label: "Keep your composure — no Aggression", check: s => count(s, 'aggression') === 0 },
    { id: 'reconcile', label: 'Reach guilt or gratitude', check: s => ['guilty','grateful','vulnerable'].includes(s.finalOpponentEmotion) },
  ],
  resource_competition: [
    { id: 'win', label: 'Claim the space', check: s => s.isVictory },
    { id: 'variety', label: 'Use three different response types', check: s => Object.keys(s.counts).filter(k => k !== 'ultimate').length >= 3 },
    { id: 'ultimate', label: 'Land your Ultimate', check: s => s.usedUltimate },
  ],
};

// ============================================================
// ENDINGS
// ============================================================

export const CONFLICT_ENDINGS: Record<string, Ending[]> = {
  group_project: [
    {
      id: 'ending_reconcile',
      title: 'He Shows Up',
      body: "Jake sends his section at 2 AM. It's rough but it's real. In the morning he thanks you — and means it.",
      condition: s => s.isVictory && count(s, 'empathy') >= 2 && count(s, 'aggression') === 0,
    },
    {
      id: 'ending_dominate',
      title: 'Forced Hand',
      body: "The work gets done. Jake doesn't look at you for the rest of the semester. You got the grade. You lost the person.",
      condition: s => s.isVictory && count(s, 'aggression') >= 2,
    },
    {
      id: 'ending_expose',
      title: 'Cold Accord',
      body: "You both turn in the project. You both know what happened. The professor never finds out.",
      condition: s => s.isVictory,
    },
    {
      id: 'ending_walk_away',
      title: 'Submitted Solo',
      body: "You give up trying and turn it in with just your name. The grade stings. The principle doesn't.",
      condition: () => true,
    },
  ],
  roommate_drama: [
    {
      id: 'ending_reconcile',
      title: 'A New Lease',
      body: "They cried a little, thanked you, and started a chore chart with stickers. It holds. Somehow, it holds.",
      condition: s => s.isVictory && ['grateful','trusting','vulnerable'].includes(s.finalOpponentEmotion),
    },
    {
      id: 'ending_standoff',
      title: 'Quiet Truce',
      body: "The apartment is cleaner. The air is not. You share a wall, a rent check, and nothing else.",
      condition: s => s.isVictory,
    },
    {
      id: 'ending_walk_away',
      title: 'The Door Closes',
      body: "They lock their room and you hear them on the other side. You don't know if you won.",
      condition: () => true,
    },
  ],
  workplace_conflict: [
    {
      id: 'ending_expose',
      title: 'Paper Trail',
      body: "You forward three months of receipts before they can spin it. Monday's meeting goes differently than they expected.",
      condition: s => s.isVictory && count(s, 'cunning') >= 1 && count(s, 'logic') >= 1,
    },
    {
      id: 'ending_dominate',
      title: 'Scorched Earth',
      body: "You got what you wanted. Everyone else in the office learned something about you — not all of it good.",
      condition: s => s.isVictory && count(s, 'aggression') >= 2,
    },
    {
      id: 'ending_reconcile',
      title: 'Uneasy Peace',
      body: "They backed down. You watch them for months after, waiting for the next move. It never comes.",
      condition: s => s.isVictory,
    },
    {
      id: 'ending_standoff',
      title: 'Draw',
      body: "Neither of you gets it. The opportunity goes to someone else. They smile at you like nothing happened.",
      condition: () => true,
    },
  ],
  family_dinner: [
    {
      id: 'ending_reconcile',
      title: 'Soft Landing',
      body: "They got quiet. Later, in the kitchen, they said 'I was being an ass, huh.' You didn't answer. They already knew.",
      condition: s => s.isVictory && ['guilty','grateful','vulnerable'].includes(s.finalOpponentEmotion),
    },
    {
      id: 'ending_dominate',
      title: 'Table Cleared',
      body: "You burned it down. Mom cried. They haven't texted in six weeks. You feel righteous and a little sick.",
      condition: s => s.isVictory && count(s, 'aggression') >= 2,
    },
    {
      id: 'ending_standoff',
      title: 'Swallowed',
      body: "The conversation moved on. Nothing was resolved. Nothing ever is, at this table.",
      condition: s => s.isVictory,
    },
    {
      id: 'ending_walk_away',
      title: 'Dessert Skipped',
      body: "You stand up mid-sentence and drive home. Your partner asks how it went. You don't have words yet.",
      condition: () => true,
    },
  ],
  resource_competition: [
    {
      id: 'ending_reconcile',
      title: 'Shared Space',
      body: "You end up studying together. You actually get more done than you would have alone.",
      condition: s => s.isVictory && count(s, 'empathy') >= 1,
    },
    {
      id: 'ending_dominate',
      title: 'Taken',
      body: "The room is yours. They head to the coffee shop. You remember this the next time you need a favor.",
      condition: s => s.isVictory,
    },
    {
      id: 'ending_walk_away',
      title: 'Surrendered',
      body: "Library it is. You didn't get the space — but you didn't burn anything down either.",
      condition: () => true,
    },
  ],
};

// ============================================================
// HELPERS
// ============================================================

export function summarize(state: {
  isVictory: boolean;
  round: number;
  player: { hp: number };
  opponent: { hp: number; emotion: string };
  maxCombo: number;
  counts: Record<string, number>;
  dialogue: Array<{ emo?: string }>;
}): ObjectiveSummary {
  const emotionsVisited = Array.from(
    new Set(state.dialogue.map(d => d.emo).filter(Boolean) as string[])
  );
  return {
    isVictory: state.isVictory,
    turns: state.round - 1,
    finalPlayerHp: state.player.hp,
    finalOpponentHp: state.opponent.hp,
    maxCombo: state.maxCombo,
    counts: state.counts,
    finalOpponentEmotion: state.opponent.emotion,
    usedUltimate: (state.counts.ultimate ?? 0) > 0,
    emotionsVisited,
  };
}

export function pickEnding(conflictId: string, summary: ObjectiveSummary): Ending | null {
  const endings = CONFLICT_ENDINGS[conflictId];
  if (!endings) return null;
  for (const e of endings) if (e.condition(summary)) return e;
  return endings[endings.length - 1] ?? null;
}

export function parseConflictId(scenarioId: string): string {
  const known = [
    'group_project','roommate_drama','workplace_conflict',
    'family_dinner','resource_competition',
  ];
  for (const c of known) if (scenarioId.startsWith(c + '_')) return c;
  return scenarioId;
}

export function previewPlayerLine(
  scenarioId: string | undefined,
  playerId: string,
  type: RespType,
  fallback: string
): string {
  const script = scenarioId ? SCENARIO_SCRIPTS[scenarioId] : null;
  const line = script?.playerLines?.[playerId]?.[type] ?? fallback;
  const trimmed = line.length > 72 ? line.slice(0, 70).trimEnd() + '\u2026' : line;
  return '\u201C' + trimmed + '\u201D';
}
