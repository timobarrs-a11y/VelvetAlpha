import type { Scene } from './engine';

// Jake: the group-project slacker, rebuilt as a conversation.
// He only tells you about his mom if you have earned it. Push too hard and he logs off.

export const JAKE: Scene = {
  id: 'jake_group_project',
  title: 'The Night Before',
  setup: "Jake hasn't shown up to a single meeting. You texted twice. It's 9 PM the night before it's due and he's online — you can see him on Discord, playing games.",
  them: { name: 'Jake', icon: '🎮' },
  start: 'open',
  initial: { trust: 40, outcome: 20 },
  subtext: "Jake's mom had a procedure two weeks ago. He has been driving to the hospital every night and couldn't find a way to say it that didn't sound like an excuse. Gaming was the only hour of the day that felt normal.",
  nodes: {
    open: {
      id: 'open',
      mood: 'Evasive',
      speaker: { variants: [{ text: "Oh hey. Yeah, the project. I was gonna get to it, honestly — it's just been a week, you know?" }] },
      choices: [
        {
          id: 'open_ask', tactic: 'empathy',
          text: "Jake, I'm not here to bury you. You've been gone for weeks. What's actually going on?",
          effect: { trust: 15 }, remember: ['asked'],
          next: [{ to: 'deflect' }],
          insight: 'Asking before accusing told him this was safe to answer.',
        },
        {
          id: 'open_task', tactic: 'logic',
          text: "Section four is empty and it's due in eleven hours. What can you own tonight?",
          effect: { outcome: 10 },
          next: [{ to: 'task' }],
          insight: 'Straight to the work. Efficient, and it let him keep hiding.',
        },
        {
          id: 'open_callout', tactic: 'aggression',
          text: "Don't 'hey' me. I can see you on Discord. You've been playing games all night.",
          effect: { trust: -15 }, remember: ['called_out'],
          next: [{ to: 'defensive' }],
          insight: 'Catching him out felt fair, and it put him on defense from the first line.',
        },
        {
          id: 'open_cover', tactic: 'cunning',
          text: "I'll tell the professor you were sick if you finish the data section tonight.",
          effect: { trust: 5, outcome: 10 }, remember: ['promised_cover'],
          next: [{ to: 'task' }],
          insight: 'Offering cover bought cooperation, and a lie you both now share.',
        },
      ],
    },

    deflect: {
      id: 'deflect',
      mood: 'Guarded',
      speaker: { variants: [{ text: "It's... nothing. Seriously. Just a lot going on. You know how it is." }] },
      choices: [
        {
          id: 'deflect_stay', tactic: 'empathy',
          text: "It's been a month, not a week. I'm not mad. I just want to know if you're okay.",
          effect: { trust: 15 },
          next: [{ when: { trustGte: 60 }, to: 'reveal' }, { to: 'task' }],
          insight: "Staying with the question after he dodged it is what let him answer it.",
        },
        {
          id: 'deflect_drop', tactic: 'logic',
          text: "Okay. Then let's just get it done.",
          effect: { trust: -5, outcome: 10 },
          next: [{ to: 'task' }],
          insight: 'He gave you "nothing" and you took it. He was relieved, and a little disappointed.',
        },
        {
          id: 'deflect_snap', tactic: 'aggression',
          text: "Everyone has a lot going on. The rest of us still showed up.",
          effect: { trust: -20 }, remember: ['called_out'],
          next: [{ to: 'defensive' }],
          insight: 'He had half-opened the door. Comparing him to everyone else shut it.',
        },
      ],
    },

    task: {
      id: 'task',
      mood: 'Compliant',
      speaker: {
        variants: [
          { when: { has: ['promised_cover'] }, text: "Wait — you'd actually cover for me? ...Okay. Yeah. Send me the data section." },
          { when: { trustLt: 30 }, text: "Fine. Whatever. Send me what's left." },
          { text: "Okay, fine. Send me whatever part's left. I'll crank it out tonight." },
        ],
      },
      choices: [
        {
          id: 'task_check', tactic: 'empathy',
          text: "Before I send it — are you okay? You've been really gone.",
          effect: { trust: 15 }, remember: ['asked'],
          next: [{ when: { trustGte: 55 }, to: 'reveal' }, { to: 'halfway' }],
          insight: 'Asking once the pressure was off gave him room to answer.',
        },
        {
          id: 'task_deadline', tactic: 'logic',
          text: "Data section. Two hours. Send it to me by midnight.",
          effect: { outcome: 15 },
          next: [{ to: 'halfway' }],
          insight: 'Clear and fair. The work moved; you never found out why it had stopped.',
        },
        {
          id: 'task_threat', tactic: 'aggression',
          text: "If it's not in by midnight, your name comes off it.",
          effect: { trust: -15, outcome: 10 }, remember: ['threatened'],
          next: [{ when: { trustLt: 20 }, to: 'logoff' }, { to: 'halfway' }],
          insight: 'The threat worked on the deadline and cost you the person.',
        },
      ],
    },

    defensive: {
      id: 'defensive',
      mood: 'Defensive',
      speaker: { variants: [{ text: "Whoa. It's a group project, not a trial. You don't know what my week's been like." }] },
      choices: [
        {
          id: 'def_soften', tactic: 'empathy',
          text: "You're right. I don't. Tell me.",
          effect: { trust: 20 }, remember: ['asked'],
          next: [{ when: { trustGte: 45 }, to: 'reveal' }, { to: 'task' }],
          insight: 'Admitting you didn\'t know was the most disarming thing you said.',
        },
        {
          id: 'def_grade', tactic: 'aggression',
          text: "I don't care what your week was. I care about the grade.",
          effect: { trust: -20 },
          next: [{ when: { trustLt: 20 }, to: 'logoff' }, { to: 'task' }],
          insight: 'He had just told you there was a reason. You told him it didn\'t matter.',
        },
        {
          id: 'def_professor', tactic: 'manipulation',
          text: "Fine. I'll just tell the professor you dropped out of the group. Your call.",
          effect: { trust: -15, outcome: 5 }, remember: ['threatened'],
          next: [{ when: { trustLt: 20 }, to: 'logoff' }, { to: 'task' }],
          insight: 'Leverage instead of a question. He heard: you are a problem to be managed.',
        },
      ],
    },

    reveal: {
      id: 'reveal',
      narration: 'He goes quiet. His Discord status flips to idle.',
      mood: 'Vulnerable',
      speaker: {
        variants: [
          { when: { has: ['promised_cover'] }, text: "...my mom had a procedure two weeks ago. I've been driving to the hospital every night. And you were going to lie to the professor for me without even knowing why." },
          { text: "...my mom had a procedure two weeks ago. I've been driving to the hospital every night. I didn't know how to say it without it sounding like an excuse." },
        ],
      },
      choices: [
        {
          id: 'reveal_her', tactic: 'empathy',
          text: "That's not an excuse. That's a reason. Is she okay?",
          effect: { trust: 20 }, remember: ['heard_him'],
          next: [{ to: 'plan' }],
          insight: 'Asking about her, not the project, is the moment he decided you were on his side.',
        },
        {
          id: 'reveal_extension', tactic: 'logic',
          text: "I'm sorry. Let's tell the professor the truth and ask for an extension. Together.",
          effect: { trust: 10, outcome: 15 }, remember: ['heard_him', 'extension'],
          next: [{ to: 'plan' }],
          insight: 'You turned his secret into a plan, and replaced the lie with the truth.',
        },
        {
          id: 'reveal_deadline', tactic: 'logic',
          text: "That's awful. But the deadline is still the deadline.",
          effect: { trust: -25, outcome: 5 },
          next: [{ to: 'halfway' }],
          insight: 'Technically true. He will remember that you said "but" right after "awful".',
        },
      ],
    },

    plan: {
      id: 'plan',
      mood: 'Grateful',
      speaker: {
        variants: [
          { when: { has: ['extension'] }, text: "Yeah. Okay. I'll email him tonight. And I'll still send you the data section — I want to." },
          { text: "She's home now. She's okay. ...Give me the data section. I want to do it. I need something normal." },
        ],
      },
      choices: [
        {
          id: 'plan_share', tactic: 'empathy',
          text: "Take the data section. I'll do the analysis. Text me if you get stuck.",
          effect: { trust: 5, outcome: 30 },
          next: [{ to: 'end' }],
          insight: 'You split the load and left the door open.',
        },
        {
          id: 'plan_owe', tactic: 'aggression',
          text: "Data section and the conclusion. You owe me that much.",
          effect: { trust: -15, outcome: 30 },
          next: [{ to: 'end' }],
          insight: 'He would have done it anyway. "You owe me" turned a gift into a debt.',
        },
      ],
    },

    halfway: {
      id: 'halfway',
      mood: 'Withdrawn',
      speaker: {
        variants: [
          { when: { has: ['threatened'] }, text: "Got it. Midnight. Message received." },
          { when: { trustLt: 30 }, text: "Whatever. I'll send it." },
          { text: "Yeah. Fine. I'll send it." },
        ],
      },
      choices: [
        {
          id: 'half_thanks', tactic: 'empathy',
          text: "Thanks. Seriously.",
          effect: { trust: 5, outcome: 15 },
          next: [{ to: 'end' }],
          insight: 'A small thank-you. It landed, a little.',
        },
        {
          id: 'half_push', tactic: 'aggression',
          text: "Midnight. I'm not asking twice.",
          effect: { trust: -10, outcome: 15 },
          next: [{ when: { trustLt: 20 }, to: 'logoff' }, { to: 'end' }],
          insight: 'He had already agreed. The last word was for you, not for the project.',
        },
        {
          id: 'half_ask', tactic: 'empathy',
          text: "Jake — is something going on? You've been gone a month.",
          requires: { lacks: ['heard_him'] },
          effect: { trust: 10 }, remember: ['asked'],
          next: [{ when: { trustGte: 55 }, to: 'reveal' }, { to: 'end' }],
          insight: 'A late question. Whether it worked depended on everything before it.',
        },
      ],
    },

    logoff: {
      id: 'logoff',
      narration: 'His icon goes grey.',
      mood: 'Gone',
      speaker: { variants: [{ text: '[Jake is offline]' }] },
      choices: [],
    },

    end: {
      id: 'end',
      narration: 'The shared doc shows him typing.',
      mood: 'Working',
      speaker: {
        variants: [
          { when: { trustGte: 70 }, text: "Hey. Thanks for actually asking." },
          { when: { trustLt: 30 }, text: "On it." },
          { text: "Okay. Starting now." },
        ],
      },
      choices: [],
    },
  },

  endings: [
    {
      id: 'logged_off', title: 'Submitted Solo', when: { trustLt: 20, outcomeLt: 45 },
      body: "He never sends anything. You finish it alone at 4 AM and submit with your name only. Next semester he sits on the other side of the room.",
    },
    {
      id: 'the_truth', title: 'The Truth, Out Loud', when: { has: ['extension'], trustGte: 55 },
      body: "You email the professor together. You get two extra days. Jake's section is the best part of the project, and he tells you so himself.",
    },
    {
      id: 'shows_up', title: 'He Shows Up', when: { has: ['heard_him'], trustGte: 65 },
      body: "Jake sends his section at 2 AM. It's rough, but it's real. In the morning he texts you a photo of his mom on the couch: 'she says hi.'",
    },
    {
      id: 'forced_hand', title: 'Forced Hand', when: { outcomeGte: 45, trustLt: 35 },
      body: "The work gets done. Jake doesn't look at you for the rest of the semester. You got the grade. You lost the person.",
    },
    {
      id: 'almost', title: 'One Question Away', when: { trustGte: 50, lacks: ['heard_him'] },
      body: "He sends his section at 1 AM with a 'thanks.' Months later you find out his mom was in the hospital that whole time. He almost told you.",
    },
    {
      id: 'cold_accord', title: 'Cold Accord', when: { outcomeGte: 40 },
      body: "You both turn in the project. Neither of you mentions tonight again.",
    },
    {
      id: 'rough_draft', title: 'Something, Not Enough',
      body: "He sends half a section at 3 AM. You patch the rest. It's done, and it doesn't feel like anything got solved.",
    },
  ],
};
