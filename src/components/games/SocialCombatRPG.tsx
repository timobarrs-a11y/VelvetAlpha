import { useState, useEffect, useRef, useCallback, Fragment, type CSSProperties } from "react";
import {
  SCENARIO_SCRIPTS,
  CONFLICT_OBJECTIVES,
  pickEnding,
  summarize as summarizeObjectives,
  parseConflictId,
  previewPlayerLine,
  type RespType,
} from "../../game/social-combat/scripts";
import {
  recordRun,
  getMemory,
  updateMemory,
  type CombatMemory,
  type CombatOutcome,
} from "../../services/socialCombatService";
import {
  getFieldNotes,
  recordFieldNote,
  discoveredCount,
  type Eff,
} from "../../game/social-combat/fieldNotes";

type EmotionKey = 'confident' | 'vulnerable' | 'grateful' | 'angry' | 'annoyed' | 'lazy' | 'guilty' | 'doubtful' | 'trusting' | 'defensive' | 'hostile' | 'overconfident';
type CharKey = 'scholar' | 'athlete' | 'artist';
type UltKey = 'scholar' | 'athlete' | 'artist';
type PerkId = 'iron_will' | 'silver_tongue' | 'sharp_tongue' | 'steel_nerves' | 'adrenaline' | 'fortune' | 'momentum' | 'second_wind' | 'versatile' | 'combo_master';
type EffType = 'super' | 'normal' | 'weak' | 'heal' | 'combo';

interface CharDef {
  id: string;
  name: string;
  icon: string;
  archetype: string;
  description: string;
  strongResponses: RespType[];
  weakResponses: RespType[];
  baseResponses: RespType[];
  ultimate: UltKey;
}

interface PlayerState {
  id: string;
  name: string;
  icon: string;
  archetype: string;
  hp: number;
  maxHp: number;
  emotion: EmotionKey;
  responses: RespType[];
  history: string[];
  charge: number;
  perks: PerkId[];
  ultimate: UltKey;
  strongResponses: RespType[];
  weakResponses: RespType[];
  baseResponses: RespType[];
  description?: string;
}

interface OpponentState {
  id: string;
  name: string;
  icon: string;
  archetype: string;
  emotion: EmotionKey;
  hp: number;
  maxHp: number;
  specials?: string[];
  stageHp?: number;
  bossHp?: number;
  specialDesc?: string;
  startingEmotion?: EmotionKey;
  conflict?: string;
}

interface Scenario {
  id: string;
  conflictId: string;
  opponent: Omit<OpponentState, 'emotion' | 'hp' | 'maxHp'>;
  setup: string;
  startingEmotion: EmotionKey;
}

interface DialogueEntry {
  id: string;
  speaker?: string;
  text: string;
  side?: 'plr' | 'opp';
  emo?: EmotionKey;
  isSystem?: boolean;
  isNarrative?: boolean;
  isCrit?: boolean;
  isUlt?: boolean;
  eff?: EffType;
}

interface GameEvent {
  kind: 'shake' | 'particles' | 'damage';
  intensity?: number;
  color?: string;
  count?: number;
  burst?: string;
  value?: number;
  target?: 'opp' | 'plr';
  eff?: EffType;
  isCrit?: boolean;
  isUlt?: boolean;
}

interface GameState {
  player: PlayerState;
  opponent: OpponentState;
  round: number;
  dialogue: DialogueEntry[];
  phase: 'intro' | 'playing' | 'gameover';
  isVictory: boolean;
  scenario: Scenario;
  counts: Record<string, number>;
  combo: number;
  maxCombo: number;
  firedBeats: string[];
}

interface ProcessResult {
  next: GameState;
  events: GameEvent[];
}

interface InitOpts {
  perks?: PerkId[];
  carryHp?: number | null;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  duration: number;
}

interface DamageNumber {
  id: string;
  x: number;
  y: number;
  value: number;
  eff: EffType;
  isCrit: boolean;
  isUlt: boolean;
}

interface AscentRun {
  stages: StageDef[];
  stage: number;
  perks: PerkId[];
  totalRounds: number;
  maxCombo: number;
}

interface StageDef {
  id: string;
  conflictId: string;
  opponent: Omit<OpponentState, 'emotion' | 'hp' | 'maxHp'>;
  setup: string;
  startingEmotion: EmotionKey;
  stage: number;
  isBoss?: boolean;
}

interface PerkOption {
  id: PerkId;
  name: string;
  icon: string;
  color: string;
  desc: string;
}

interface TutorialStep {
  before: { title: string; body: string };
  setup: { emotion: EmotionKey; charge?: number } | null;
  instruct: string;
  forceResponse: RespType | 'ultimate';
  after: { title: string; body: string; isFinal?: boolean };
}

interface TutorialState {
  step: number;
  phase: 'before' | 'action' | 'after';
}

// ==================== DATA ====================

const EMOTIONS: Record<EmotionKey, { name: string; icon: string; color: string; aura: string }> = {
  lazy:          { name: 'Lazy',          icon: '😴', color: '#9CA3AF', aura: 'rgba(156,163,175,0.5)' },
  annoyed:       { name: 'Annoyed',       icon: '😒', color: '#FB923C', aura: 'rgba(251,146,60,0.55)' },
  defensive:     { name: 'Defensive',     icon: '🛡️', color: '#60A5FA', aura: 'rgba(96,165,250,0.55)' },
  angry:         { name: 'Angry',         icon: '😠', color: '#F87171', aura: 'rgba(248,113,113,0.6)' },
  hostile:       { name: 'Hostile',       icon: '🤬', color: '#DC2626', aura: 'rgba(220,38,38,0.65)' },
  guilty:        { name: 'Guilty',        icon: '😔', color: '#A78BFA', aura: 'rgba(167,139,250,0.55)' },
  vulnerable:    { name: 'Vulnerable',    icon: '🥺', color: '#F9A8D4', aura: 'rgba(249,168,212,0.55)' },
  trusting:      { name: 'Trusting',      icon: '🤝', color: '#4ADE80', aura: 'rgba(74,222,128,0.55)' },
  grateful:      { name: 'Grateful',      icon: '😊', color: '#34D399', aura: 'rgba(52,211,153,0.55)' },
  confident:     { name: 'Confident',     icon: '😎', color: '#FBBF24', aura: 'rgba(251,191,36,0.55)' },
  doubtful:      { name: 'Doubtful',      icon: '🤔', color: '#94A3B8', aura: 'rgba(148,163,184,0.55)' },
  overconfident: { name: 'Overconfident', icon: '💪', color: '#FB7185', aura: 'rgba(251,113,133,0.6)' },
};

const RESP: Record<RespType, { label: string; icon: string; color: string; bg: string; particle: string }> = {
  empathy:      { label: 'Empathy',      icon: '💙', color: '#3B82F6', bg: 'linear-gradient(135deg,#3B82F6,#2563EB)', particle: '#60A5FA' },
  logic:        { label: 'Logic',        icon: '🧠', color: '#10B981', bg: 'linear-gradient(135deg,#10B981,#059669)', particle: '#34D399' },
  manipulation: { label: 'Manipulation', icon: '🎭', color: '#8B5CF6', bg: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', particle: '#A78BFA' },
  aggression:   { label: 'Aggression',   icon: '⚡', color: '#EF4444', bg: 'linear-gradient(135deg,#EF4444,#DC2626)', particle: '#F87171' },
  cunning:      { label: 'Cunning',      icon: '🦊', color: '#F97316', bg: 'linear-gradient(135deg,#F97316,#EA580C)', particle: '#FB923C' },
};

const ULTIMATES: Record<UltKey, { name: string; icon: string; tagline: string; desc: string; color: string; gradient: string; voiceLine: string }> = {
  scholar: {
    name: "Socratic Method", icon: "📖", tagline: "Use their words against them",
    desc: "Base 40 damage + 8 per unique response you've used",
    color: '#10B981', gradient: 'linear-gradient(135deg,#10B981,#059669,#047857)',
    voiceLine: "Every contradiction you've offered today is about to meet its conclusion.",
  },
  athlete: {
    name: "Full Court Press", icon: "🔥", tagline: "Dominate the moment",
    desc: "50 damage, restore 20 HP, force opponent on their heels",
    color: '#EF4444', gradient: 'linear-gradient(135deg,#F97316,#EF4444,#DC2626)',
    voiceLine: "No more dancing around it. This ends right now.",
  },
  artist: {
    name: "Heart to Heart", icon: "💫", tagline: "See them, truly",
    desc: "35 damage, exposes their core — forces Vulnerable state",
    color: '#8B5CF6', gradient: 'linear-gradient(135deg,#EC4899,#8B5CF6,#6366F1)',
    voiceLine: "I see what you're really feeling. And it's okay to feel it.",
  },
};

const CHARS: Record<CharKey, CharDef> = {
  scholar: {
    id:'scholar', name:'The Scholar', icon:'🎓', archetype:'Smart & Methodical',
    description:'Thinks through problems logically and understands others well, but less direct.',
    strongResponses:['logic','empathy'], weakResponses:['aggression'],
    baseResponses:['empathy','logic','manipulation','aggression'], ultimate: 'scholar',
  },
  athlete: {
    id:'athlete', name:'The Athlete', icon:'🏆', archetype:'Direct & Action-Oriented',
    description:'Prefers direct confrontation and action over complex social maneuvering.',
    strongResponses:['aggression'], weakResponses:[],
    baseResponses:['empathy','logic','aggression','cunning'], ultimate: 'athlete',
  },
  artist: {
    id:'artist', name:'The Artist', icon:'🎨', archetype:'Creative & Emotionally Aware',
    description:'Highly attuned to emotions and creative solutions, but may struggle with hard logic.',
    strongResponses:['empathy'], weakResponses:[],
    baseResponses:['empathy','logic','manipulation','aggression','cunning'], ultimate: 'artist',
  },
};

const EFF_CHART: Record<RespType, { sup: EmotionKey[]; weak: EmotionKey[] }> = {
  logic:        { sup:['annoyed','overconfident','defensive'], weak:['confident','grateful','trusting'] },
  empathy:      { sup:['guilty','vulnerable','doubtful'],      weak:['angry','hostile','overconfident'] },
  manipulation: { sup:['trusting','confident','lazy'],         weak:['doubtful','defensive','hostile'] },
  aggression:   { sup:['lazy','doubtful','trusting'],          weak:['vulnerable','grateful','defensive'] },
  cunning:      { sup:['annoyed','guilty','vulnerable'],       weak:['hostile','grateful','overconfident'] },
};

const EMO_TRANS: Record<EmotionKey, Record<RespType, EmotionKey>> = {
  lazy:          { logic:'annoyed',   empathy:'guilty',     manipulation:'confident',     aggression:'defensive', cunning:'trusting'  },
  annoyed:       { logic:'defensive', empathy:'guilty',     manipulation:'angry',         aggression:'angry',     cunning:'confident' },
  defensive:     { logic:'doubtful',  empathy:'vulnerable', manipulation:'angry',         aggression:'hostile',   cunning:'doubtful'  },
  guilty:        { logic:'doubtful',  empathy:'vulnerable', manipulation:'defensive',     aggression:'angry',     cunning:'trusting'  },
  vulnerable:    { logic:'trusting',  empathy:'grateful',   manipulation:'defensive',     aggression:'hostile',   cunning:'doubtful'  },
  confident:     { logic:'doubtful',  empathy:'grateful',   manipulation:'overconfident', aggression:'annoyed',   cunning:'trusting'  },
  angry:         { logic:'defensive', empathy:'guilty',     manipulation:'hostile',       aggression:'hostile',   cunning:'annoyed'   },
  hostile:       { logic:'angry',     empathy:'defensive',  manipulation:'angry',         aggression:'hostile',   cunning:'defensive' },
  trusting:      { logic:'confident', empathy:'grateful',   manipulation:'overconfident', aggression:'defensive', cunning:'confident' },
  grateful:      { logic:'confident', empathy:'vulnerable', manipulation:'trusting',      aggression:'defensive', cunning:'trusting'  },
  doubtful:      { logic:'confident', empathy:'trusting',   manipulation:'defensive',     aggression:'angry',     cunning:'confident' },
  overconfident: { logic:'annoyed',   empathy:'confident',  manipulation:'confident',     aggression:'defensive', cunning:'doubtful'  },
};

const DIALOGUE: Record<EmotionKey, { base: string; afterLogic: string; afterEmpathy: string; afterManipulation: string; afterAggression: string; afterCunning: string }> = {
  lazy:{ base:"Honestly, I'm just so swamped right now. Can't you handle this one? You're better at it anyway.", afterLogic:"Okay, okay. A lecture on responsibility. Just what I needed today.", afterEmpathy:"I mean... you're right. I guess I've been avoiding it. It's just a lot, you know?", afterManipulation:"You know what? You're totally right. I'll get on it right away!", afterAggression:"Whoa, calm down! No need to get so intense about a simple thing.", afterCunning:"Huh. I never thought of it that way. That's actually pretty clever." },
  annoyed:{ base:"Look, I've had a long day and I don't have patience for this. Tell me what you want and let's get it over with.", afterLogic:"Don't try to reason with me right now. I'm not in the mood for a debate.", afterEmpathy:"Fine. I know I'm being difficult. I'm just... stressed out. Sorry for snapping.", afterManipulation:"Are you trying to trick me? Because I can tell, and it's not working.", afterAggression:"You want a fight? Because I am more than happy to have one right now!", afterCunning:"That's... an interesting point. Let me think about that for a second." },
  guilty:{ base:"You're right. I know I messed up, and there's no excuse for what I did. I feel terrible.", afterLogic:"Logically I know you're correct. It was my responsibility and I dropped the ball.", afterEmpathy:"Thank you for being understanding. It means a lot that you're not just attacking me.", afterManipulation:"You're right, I need to make this right. Just tell me what to do.", afterAggression:"Yelling isn't going to help! I already feel bad enough as it is.", afterCunning:"That's a way out. Are you sure it would work? It feels a bit sneaky to me." },
  confident:{ base:"Don't worry, I've got this completely under control. Just follow my lead and everything will be fine.", afterLogic:"Hmm, you're making some valid points. I hadn't considered that perspective.", afterEmpathy:"I appreciate you seeing my side. Good to be on the same page.", afterManipulation:"You're right! Focusing on that bigger goal is key. Great strategic thinking!", afterAggression:"There's no need for hostility. We can discuss this like adults.", afterCunning:"That's a very clever observation. I have to admit, I'm impressed." },
  defensive:{ base:"I'm not the bad guy here, okay? I'm just doing what I think is best for everyone.", afterLogic:"Okay... I can see the logic in what you're saying. Maybe I did overreact a bit.", afterEmpathy:"Look, I'm just trying to protect myself. I don't want to get burned again.", afterManipulation:"Stop trying to twist my words! That's not what I meant and you know it.", afterAggression:"You're attacking me! Why? I haven't done anything wrong!", afterCunning:"I'm not sure I can trust that approach. It sounds like you're setting me up." },
  angry:{ base:"This is completely ridiculous! I can't believe you're putting me in this impossible position.", afterLogic:"Don't throw logic at me! This isn't about logic, it's about the principle of the thing!", afterEmpathy:"I'm just so frustrated with this whole situation. It feels completely unfair.", afterManipulation:"Seriously trying to manipulate me while I'm this angry? That's a really bad move.", afterAggression:"Oh, you want to escalate? Let's escalate! I'm completely done talking!", afterCunning:"I see exactly what you're doing. Very clever. But it won't work on me." },
  hostile:{ base:"You've got a lot of nerve talking to me like that. Watch your tone.", afterLogic:"Your precious 'logic' is pathetic. Get out of my face.", afterEmpathy:"Save your fake sympathy for someone who cares. I don't need your pity.", afterManipulation:"You think your little mind games will work on me? Think again.", afterAggression:"You just made a very big mistake. Prepare yourself.", afterCunning:"Cute trick. Try it on someone who actually cares what you think." },
  vulnerable:{ base:"Honestly, I'm not sure I can handle this anymore. I feel completely lost and overwhelmed.", afterLogic:"When you break it down like that... it actually seems more manageable. Thank you.", afterEmpathy:"Thank you for listening. It means a lot that you're not judging me.", afterManipulation:"I guess you're right. I don't have other options, so I'll trust you on this.", afterAggression:"Please, don't yell at me. I honestly can't handle any more conflict right now.", afterCunning:"I don't know if that's the right thing to do, but I don't have better ideas." },
  trusting:{ base:"That makes perfect sense to me. I'm completely happy to go along with your plan!", afterLogic:"That's a solid plan. I'm fully on board with that approach.", afterEmpathy:"I knew I could count on you to understand this situation.", afterManipulation:"Absolutely! Let's do it your way — it sounds brilliant.", afterAggression:"Whoa, why the sudden change? I thought we were working together here.", afterCunning:"That sounds like a great shortcut! Let's go with that approach." },
  grateful:{ base:"Thank you so much for everything. I really appreciate all your help — I couldn't do it without you.", afterLogic:"That's a great point. Thanks for taking the time to clarify that.", afterEmpathy:"It feels so good to finally be understood by someone. Thank you.", afterManipulation:"You always have the best ideas. Thank you so much for sharing that!", afterAggression:"I... I don't understand. I thought we were getting along really well.", afterCunning:"Oh, that's really smart! Thank you for showing me that clever approach." },
  doubtful:{ base:"I'm really not sure about this. It seems risky and I don't see how it could possibly work.", afterLogic:"When you lay it out step by step, it does make much more sense. Okay, I'm convinced.", afterEmpathy:"I appreciate you hearing out my concerns instead of just dismissing them.", afterManipulation:"Something still feels off, but I guess I'll go along with it.", afterAggression:"See! This is exactly why I was worried. You're being completely unreasonable.", afterCunning:"That's a loophole I didn't see. Clever, but is it really the right thing to do?" },
  overconfident:{ base:"Please, I've done this a thousand times. I could literally do this in my sleep.", afterLogic:"Wait... your logic is actually sound. I may have overlooked a few important details.", afterEmpathy:"Sympathy is for the weak. We just need to focus and execute the plan.", afterManipulation:"Of course! My brilliance combined with your idea? Absolutely unstoppable.", afterAggression:"Are you questioning my ability? You have no idea who you're talking to.", afterCunning:"Clever trick for a lesser mind. My approach is still obviously superior." },
};

const PLAYER_DLG: Record<string, Partial<Record<RespType, string>>> = {
  scholar:{ logic:"Let's approach this systematically. If we map out the variables, we can find the optimal path forward.", empathy:"I can see this is really difficult for you. Let's take a step back and talk about what's going on.", manipulation:"If we frame this correctly, we can make this work for both of us. Think about the long-term benefits.", aggression:"I've analyzed this thoroughly, and this behavior is suboptimal. We need to correct course immediately.", cunning:"There's a clever workaround here that most people miss. What if we approach it from this angle instead?" },
  athlete:{ logic:"Look, let's cut through the talk. What's our objective here and what's our play to win?", empathy:"Hey, team check. Are you okay? You seem like you're not playing at your usual level right now.", aggression:"Stop making excuses and get in the game. We're here to win, not to complain.", manipulation:"Come on, we're the power players here. Let's show everyone what a real team can do.", cunning:"Smart play — there's an angle here nobody sees coming. Let me show you how this wins the game." },
  artist:{ logic:"Let's step back and look at the whole canvas. There's a much bigger picture we're not seeing.", empathy:"I can feel all the tension here. This isn't really about the task, is it? Let's connect on a human level.", manipulation:"Just imagine how amazing it'll feel when we've created something beautiful together.", aggression:"All this negative energy is poisoning our creative process. We need to purify this space.", cunning:"There's a really creative solution hiding here that nobody else would think of. What do you think?" },
};

const CONFLICTS: { id: string; setup: string }[] = [
  { id:'group_project',       setup:"The deadline for your group project is tomorrow, and your partner {NAME} hasn't contributed anything meaningful. Your grade depends on this collaboration." },
  { id:'roommate_drama',      setup:"{NAME} has been leaving dirty dishes everywhere, playing loud music at night, and bringing strangers over. The lease is in both your names." },
  { id:'workplace_conflict',  setup:"Your coworker {NAME} has been taking credit for your ideas in meetings. A big promotion is coming up and you need to address this — now." },
  { id:'family_dinner',       setup:"At the family gathering, {NAME} keeps making comments about your life choices. Everyone's watching. You need to handle this delicately but firmly." },
  { id:'resource_competition',setup:"You and {NAME} both need the last available study room during finals week. You both have legitimate claims and time is running out." },
];

const OPPONENTS: { id: string; name: string; archetype: string; icon: string; startingEmotion: EmotionKey }[] = [
  { id:'slacker',       name:"Jake Morrison",    archetype:"The Slacker",        icon:"😎", startingEmotion:"lazy"       },
  { id:'perfectionist', name:"Sarah Chen",        archetype:"The Perfectionist",  icon:"📊", startingEmotion:"confident"  },
  { id:'hothead',       name:"Marcus Rodriguez",  archetype:"The Hothead",        icon:"😤", startingEmotion:"annoyed"    },
  { id:'manipulator',   name:"Alex Thompson",     archetype:"The Manipulator",    icon:"🎭", startingEmotion:"confident"  },
  { id:'anxious',       name:"Emma Davis",        archetype:"The Anxious One",    icon:"😰", startingEmotion:"vulnerable" },
];

const BOSSES: { id: string; name: string; archetype: string; icon: string; startingEmotion: EmotionKey; bossHp: number; specials: string[]; specialDesc: string; conflict: string }[] = [
  {
    id:'director_hollis', name:"Director Hollis", archetype:"The Immovable Authority",
    icon:"💼", startingEmotion:"overconfident", bossHp:140,
    specials:['emotionResist'], specialDesc:"30% chance to resist emotional shifts",
    conflict:"Director Hollis holds your project's future in their hands. They've publicly questioned your competence and now expect you to grovel for approval. This meeting decides everything — your position, your team, your next year.",
  },
  {
    id:'mira_kline', name:"Mira Kline", archetype:"The Master Manipulator",
    icon:"🎭", startingEmotion:"confident", bossHp:130,
    specials:['manipulationImmune'], specialDesc:"Manipulation always lands as weak",
    conflict:"Mira has been playing everyone in the office against each other for months. Today the games end. She's cornered you in the conference room and she's smiling — because she thinks she's already won.",
  },
  {
    id:'mr_ridgeway', name:"Mr. Ridgeway", archetype:"The Unreachable",
    icon:"🗿", startingEmotion:"defensive", bossHp:150,
    specials:['thickSkin'], specialDesc:"Takes 25% less damage from all hits",
    conflict:"Mr. Ridgeway has watched the company decline for thirty years, and he's convinced any change is a threat. He controls the vote that will save your department or dismantle it. He has never been moved by an argument.",
  },
];

const TUTORIAL_OPPONENT: { id: string; name: string; archetype: string; icon: string; startingEmotion: EmotionKey } = {
  id:'coach_riley', name:"Coach Riley", archetype:"Your Trainer",
  icon:"🏀", startingEmotion:"lazy",
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    before: {
      title: "Welcome to the arena",
      body: "Every conversation here is a negotiation of emotional states. You won't see effect labels on your choices — you'll see what you'd actually SAY. Read my face. Then choose the line that fits.",
    },
    setup: { emotion: 'lazy' },
    instruct: "I'm feeling Lazy (😴). Someone checked out needs to feel SEEN, not pushed. Pick the line that meets me where I am.",
    forceResponse: 'empathy',
    after: {
      title: "You landed it",
      body: "Empathy works on people who feel lazy, guilty, or vulnerable. Notice I shifted emotional state — that's how damage happens here. You'll learn the rules by watching me change.",
    },
  },
  {
    before: {
      title: "Read. Then commit.",
      body: "You'll never get a tooltip telling you what works. You'll learn by remembering what moved me, and what didn't. Stay curious. Stay watching.",
    },
    setup: null,
    instruct: "I'm Guilty now. Same line that worked before might still work. Or not. Trust what you saw. Commit.",
    forceResponse: 'empathy',
    after: {
      title: "Combos reward reading",
      body: "Chaining moves that land — super-effective hits — builds a COMBO. Up to ×1.3 damage at three in a row. Reading faster than you think is the whole game.",
    },
  },
  {
    before: {
      title: "When it doesn't land",
      body: "Some lines will fizzle. You'll feel it — small damage, harsh reply, combo broken. That's the cost of mis-reading. It's also the fastest way to learn a face.",
    },
    setup: { emotion: 'hostile' },
    instruct: "I'm Hostile now. Try the empathy line again. Feel what changes.",
    forceResponse: 'empathy',
    after: {
      title: "Lesson filed",
      body: "Weak hit. Empathy bounces off a hostile person — they don't want to be seen, they want to fight. File that away. Every face teaches you something.",
    },
  },
  {
    before: {
      title: "The Ultimate",
      body: "Your charge bar fills with every move. At 100%, your Signature Ultimate unlocks — a devastating finisher unique to your character.",
    },
    setup: { emotion: 'confident', charge: 100 },
    instruct: "You're fully charged. The Ultimate button up top is pulsing and glowing — unleash it.",
    forceResponse: 'ultimate',
    after: {
      title: "You're ready",
      body: "Emotional reading, combo chains, and ultimate timing — that's the core loop. Now go out there: try a Single Scenario to practice, or climb the Ascent for the real test.",
      isFinal: true,
    },
  },
];

const PERKS: Record<PerkId, { name: string; icon: string; color: string; desc: string }> = {
  iron_will:     { name:'Iron Will',     icon:'🛡️', color:'#10B981', desc:'+25 max HP and heal to full between stages' },
  silver_tongue: { name:'Silver Tongue', icon:'💫', color:'#8B5CF6', desc:'Start each fight with 50% charge' },
  sharp_tongue:  { name:'Sharp Tongue',  icon:'🗡️', color:'#EF4444', desc:'Deal 15% more damage on every response' },
  steel_nerves:  { name:'Steel Nerves',  icon:'🧱', color:'#3B82F6', desc:'Take 25% less damage from opposing backlash' },
  adrenaline:    { name:'Adrenaline',    icon:'⚡', color:'#F59E0B', desc:'Super effective hits grant 50% more charge' },
  fortune:       { name:'Fortune Favors',icon:'🎰', color:'#FBBF24', desc:'Critical hit chance +18% (up to 30%)' },
  momentum:      { name:'Momentum',      icon:'🌀', color:'#06B6D4', desc:"Combos never reset — only grow from super hits" },
  second_wind:   { name:'Second Wind',   icon:'🌬️', color:'#4ADE80', desc:'Heal 8 HP at the end of every round' },
  versatile:     { name:'Versatile',     icon:'🎭', color:'#C084FC', desc:'Not Very Effective hits now deal Normal damage' },
  combo_master:  { name:'Combo Master',  icon:'🔥', color:'#F472B6', desc:'Start every fight with combo counter at 1' },
};

const TIPS: Record<string, string> = {
  empathy:      "💡 Empathy works best with people who feel guilty or vulnerable. Meeting someone where they are emotionally builds trust faster than any argument.",
  logic:        "💡 Logic shines when someone is overconfident or defensive. Calmly presenting facts cuts through emotional noise without escalating.",
  aggression:   "💡 Aggression can force action in passive situations — but escalates with already-hostile people. Use it sparingly.",
  manipulation: "💡 Strategic framing works on trusting or confident people. But use it carefully — if someone senses it, trust collapses fast.",
  cunning:      "💡 Cunning finds creative exits from tense situations. It works especially well with people who feel cornered, guilty, or unsure.",
};

// ==================== ENGINE ====================

const rnd = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const uid = (): string => Math.random().toString(36).slice(2, 9);
const hasPerk = (perks: PerkId[] | undefined, id: PerkId): boolean => perks?.includes(id) || false;

const genScenario = (): Scenario => {
  const c = rnd(CONFLICTS), o = rnd(OPPONENTS);
  const id = `${c.id}_${o.id}`;
  const script = SCENARIO_SCRIPTS[id];
  return {
    id,
    conflictId: c.id,
    opponent: { id: o.id, name: o.name, archetype: o.archetype, icon: o.icon, startingEmotion: o.startingEmotion },
    setup: script?.intro || c.setup.replace('{NAME}', o.name),
    startingEmotion: o.startingEmotion as EmotionKey,
  };
};

const genAscentRun = (): { stages: StageDef[] } => {
  const shuffled = [...OPPONENTS].sort(() => Math.random() - 0.5);
  const [o1, o2] = shuffled.slice(0, 2);
  const boss = rnd(BOSSES);
  const c1 = rnd(CONFLICTS), c2 = rnd(CONFLICTS);
  const s1 = SCENARIO_SCRIPTS[`${c1.id}_${o1.id}`];
  const s2 = SCENARIO_SCRIPTS[`${c2.id}_${o2.id}`];
  return {
    stages: [
      { id:`${c1.id}_${o1.id}`, conflictId:c1.id, opponent: { id: o1.id, name: o1.name, archetype: o1.archetype, icon: o1.icon, startingEmotion: o1.startingEmotion, stageHp: 85 }, setup: s1?.intro || c1.setup.replace('{NAME}', o1.name), startingEmotion: o1.startingEmotion as EmotionKey, stage:1 },
      { id:`${c2.id}_${o2.id}`, conflictId:c2.id, opponent: { id: o2.id, name: o2.name, archetype: o2.archetype, icon: o2.icon, startingEmotion: o2.startingEmotion, stageHp: 105 }, setup: s2?.intro || c2.setup.replace('{NAME}', o2.name), startingEmotion: o2.startingEmotion as EmotionKey, stage:2 },
      { id:`boss_${boss.id}`, conflictId:'boss', opponent: { id: boss.id, name: boss.name, archetype: boss.archetype, icon: boss.icon, startingEmotion: boss.startingEmotion, stageHp: boss.bossHp, specials: boss.specials, specialDesc: boss.specialDesc, conflict: boss.conflict }, setup: boss.conflict, startingEmotion: boss.startingEmotion as EmotionKey, stage:3, isBoss:true },
    ],
  };
};

const pickPerks = (exclude: PerkId[] = []): PerkOption[] => {
  const pool = (Object.entries(PERKS) as [PerkId, typeof PERKS[PerkId]][]).filter(([id]) => !exclude.includes(id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(3, pool.length)).map(([id, p]) => ({ id, name: p.name, icon: p.icon, color: p.color, desc: p.desc }));
};

const getEff = (type: RespType, emo: EmotionKey): EffType => {
  const ch = EFF_CHART[type];
  if (ch.sup.includes(emo)) return 'super';
  if (ch.weak.includes(emo)) return 'weak';
  return 'normal';
};

const calcDamage = (eff: EffType, player: PlayerState, type: RespType, combo: number, isCrit: boolean): number => {
  const perks = player.perks || [];
  // Versatile: weak → normal damage tier
  const effTier = (eff === 'weak' && hasPerk(perks, 'versatile')) ? 'normal' : eff;
  const base = { super: 28, normal: 18, weak: 9 }[effTier as 'super' | 'normal' | 'weak'];
  const bonus = player.strongResponses.includes(type) ? 1.2 : player.weakResponses.includes(type) ? 0.8 : 1.0;
  const berserk = player.hp < 30 ? 1.5 : 1.0;
  const comboMult = combo >= 3 ? 1.3 : combo >= 2 ? 1.2 : combo >= 1 ? 1.1 : 1.0;
  const crit = isCrit ? 1.5 : 1.0;
  const sharp = hasPerk(perks, 'sharp_tongue') ? 1.15 : 1.0;
  return Math.round(base * bonus * berserk * comboMult * crit * sharp);
};

const plrDmg = (eff: EffType, perks: PerkId[]): number => {
  const base = { super: -5, normal: 4, weak: 14 }[eff as 'super' | 'normal' | 'weak'];
  if (base > 0 && hasPerk(perks, 'steel_nerves')) return Math.round(base * 0.75);
  return base;
};

const critChance = (perks: PerkId[]): number => 0.12 + (hasPerk(perks, 'fortune') ? 0.18 : 0);
const chargeGain = (eff: EffType, perks: PerkId[]): number => {
  const base = { super: 22, normal: 14, weak: 8 }[eff as 'super' | 'normal' | 'weak'];
  return eff === 'super' && hasPerk(perks, 'adrenaline') ? Math.round(base * 1.5) : base;
};

const getOppDlg = (emo: EmotionKey, type: RespType | null, scenarioId: string): string => {
  const script = scenarioId ? SCENARIO_SCRIPTS[scenarioId] : null;
  if (script) {
    if (type) {
      const reactLine = script.opponentReacts?.[emo]?.[type];
      if (reactLine) return reactLine;
    } else {
      const barkLine = script.opponentBarks?.[emo];
      if (barkLine) return barkLine;
    }
  }
  const d = DIALOGUE[emo]; if (!d) return "...";
  if (type) { const k = `after${type[0].toUpperCase()}${type.slice(1)}` as keyof typeof d; if (d[k]) return d[k]; }
  return d.base;
};

const getPlrDlg = (charId: string, type: RespType, scenarioId: string): string => {
  const script = scenarioId ? SCENARIO_SCRIPTS[scenarioId] : null;
  const override = script?.playerLines?.[charId]?.[type];
  if (override) return override;
  return (PLAYER_DLG as Record<string, Partial<Record<RespType, string>>>)[charId]?.[type] || "I need to think carefully about this.";
};

const checkUnlocks = (player: PlayerState, round: number): RespType[] => {
  const r = [...player.responses];
  if (player.id === 'scholar' && round >= 5 && player.history.includes('logic') && !r.includes('cunning')) r.push('cunning');
  return r;
};

const initState = (char: CharDef, scenario: Scenario | null, opts: InitOpts = {}): GameState => {
  const { perks = [], carryHp = null } = opts;
  const s = scenario || genScenario();
  const ironBonus = hasPerk(perks, 'iron_will') ? 25 : 0;
  const maxHp = 100 + ironBonus;
  const hp = carryHp !== null ? Math.min(carryHp + 30, maxHp) : maxHp;
  const startCharge = hasPerk(perks, 'silver_tongue') ? 50 : 0;
  const startCombo = hasPerk(perks, 'combo_master') ? 1 : 0;
  const oppHp = s.opponent.stageHp || 100;

  return {
    player: {
      id: char.id, name: char.name, icon: char.icon, archetype: char.archetype,
      hp, maxHp, emotion: 'confident',
      responses: [...char.baseResponses], history: [], charge: startCharge, perks,
      ultimate: char.ultimate, strongResponses: char.strongResponses,
      weakResponses: char.weakResponses, baseResponses: char.baseResponses,
      description: char.description,
    },
    opponent: {
      ...s.opponent, hp: oppHp, maxHp: oppHp, emotion: s.startingEmotion,
      specials: s.opponent.specials || [],
    },
    round: 1, dialogue: [], phase: 'intro', isVictory: false,
    scenario: s, counts: {}, combo: startCombo, maxCombo: startCombo,
    firedBeats: [],
  };
};

const processResp = (state: GameState, type: RespType, isUltimate = false): ProcessResult => {
  const { player, opponent, round, dialogue, scenario, counts, combo, maxCombo, firedBeats = [] } = state;
  const perks = player.perks || [];
  const events: GameEvent[] = [];

  let oppDmg = 0;
  let playerHpDelta = 0;
  let eff: EffType = 'normal';
  let isCrit = false;
  let targetEmotion: EmotionKey = opponent.emotion;
  let newCombo = combo;
  let playerDlgText = '';
  let oppReactText = '';

  if (isUltimate) {
    const ult = ULTIMATES[player.ultimate];
    playerDlgText = ult.voiceLine;
    eff = 'super';
    if (player.id === 'scholar') {
      const unique = new Set(player.history).size;
      oppDmg = 40 + 8 * unique;
    } else if (player.id === 'athlete') {
      oppDmg = 50; playerHpDelta = -20; targetEmotion = 'defensive';
    } else if (player.id === 'artist') {
      oppDmg = 35; targetEmotion = 'vulnerable';
    }
    // Apply thickSkin even to ultimates
    if (opponent.specials?.includes('thickSkin')) oppDmg = Math.round(oppDmg * 0.75);
    events.push({ kind:'shake', intensity: 14 });
    events.push({ kind:'particles', color: ult.color, count: 22, burst:'ultimate' });
    events.push({ kind:'damage', value: oppDmg, target: 'opp', eff:'super', isUlt:true });
    if (playerHpDelta < 0) events.push({ kind:'damage', value: Math.abs(playerHpDelta), target: 'plr', eff:'heal' });
    newCombo = combo + 1;
    oppReactText = getOppDlg(targetEmotion, null, scenario.id);
  } else {
    eff = getEff(type, opponent.emotion);
    // Boss special: manipulation immune
    if (opponent.specials?.includes('manipulationImmune') && type === 'manipulation' && eff !== 'weak') {
      eff = 'weak';
    }
    isCrit = eff === 'super' && Math.random() < critChance(perks);
    oppDmg = calcDamage(eff, player, type, combo, isCrit);
    // Boss special: thickSkin
    if (opponent.specials?.includes('thickSkin')) oppDmg = Math.round(oppDmg * 0.75);
    playerHpDelta = plrDmg(eff, perks);

    targetEmotion = EMO_TRANS[opponent.emotion]?.[type] || opponent.emotion;
    // Boss special: emotion resist
    if (opponent.specials?.includes('emotionResist') && Math.random() < 0.3) {
      targetEmotion = opponent.emotion;
    }

    if (eff === 'super') newCombo = combo + 1;
    else if (eff === 'weak') newCombo = hasPerk(perks, 'momentum') ? combo : Math.max(0, combo - 1);

    const shakeIntensity = eff === 'super' ? (isCrit ? 12 : 8) : eff === 'weak' ? 3 : 5;
    events.push({ kind:'shake', intensity: shakeIntensity });
    events.push({ kind:'particles', color: RESP[type].particle, count: eff === 'super' ? 14 : eff === 'normal' ? 8 : 4 });
    events.push({ kind:'damage', value: oppDmg, target: 'opp', eff, isCrit });
    if (playerHpDelta !== 0) events.push({ kind:'damage', value: Math.abs(playerHpDelta), target: 'plr', eff: playerHpDelta < 0 ? 'heal' : 'normal' });

    playerDlgText = getPlrDlg(player.id, type, scenario.id);
    oppReactText = getOppDlg(targetEmotion, type, scenario.id);
  }

  const newOppHp = Math.max(0, opponent.hp - oppDmg);
  let newPlrHp = Math.min(player.maxHp, Math.max(0, player.hp - playerHpDelta));

  // Second Wind heal at end of round (only if still alive and fight not over)
  if (hasPerk(perks, 'second_wind') && newPlrHp > 0 && newOppHp > 0) {
    const healAmt = Math.min(8, player.maxHp - newPlrHp);
    if (healAmt > 0) {
      newPlrHp += healAmt;
      events.push({ kind:'damage', value: healAmt, target: 'plr', eff:'heal' });
    }
  }

  let newCharge = player.charge;
  if (isUltimate) newCharge = 0;
  else newCharge = Math.min(100, player.charge + chargeGain(eff, perks));

  const dlg = [...dialogue];
  if (round === 1) dlg.push({ id:uid(), speaker:opponent.name, text:getOppDlg(scenario.startingEmotion, null, scenario.id), side:'opp', emo: scenario.startingEmotion });
  dlg.push({ id:uid(), speaker:player.name, text:playerDlgText, side:'plr', emo: player.emotion });

  let effLabel: string;
  if (isUltimate) effLabel = `💫 ${ULTIMATES[player.ultimate].name.toUpperCase()}! (+${oppDmg})`;
  else if (isCrit) effLabel = `⚡ CRITICAL HIT! (+${oppDmg})`;
  else effLabel = { super:`✦ Super effective! (+${oppDmg})`, normal:`• Normal hit. (+${oppDmg})`, weak:`· Not very effective... (+${oppDmg})` }[eff as 'super' | 'normal' | 'weak'];

  dlg.push({ id:uid(), isSystem:true, text:effLabel, eff, isCrit, isUlt: isUltimate });
  if (newCombo >= 2 && !isUltimate) dlg.push({ id:uid(), isSystem:true, text: `🔥 COMBO x${newCombo}!`, eff: 'combo' });
  dlg.push({ id:uid(), speaker:opponent.name, text:oppReactText, side:'opp', emo: targetEmotion });

  const newHistory = [...player.history, isUltimate ? 'ultimate' : type];
  const updatedResps = checkUnlocks(player, round);
  const newCounts = { ...counts, [isUltimate ? 'ultimate' : type]:(counts[isUltimate ? 'ultimate' : type]||0)+1 };
  const over = newPlrHp <= 0 || newOppHp <= 0;
  const newRound = round + 1;

  // Check story beats — fire any that match current state and haven't fired yet.
  const newFiredBeats = [...firedBeats];
  const beats = SCENARIO_SCRIPTS[scenario.id]?.beats || [];
  if (!over) {
    for (const beat of beats) {
      if (newFiredBeats.includes(beat.id)) continue;
      const { trigger } = beat;
      const roundMatch  = trigger.round !== undefined    ? newRound === trigger.round    : true;
      const roundGteMatch = trigger.roundGte !== undefined ? newRound >= trigger.roundGte : true;
      const plrHpMatch  = trigger.playerHpBelow !== undefined ? newPlrHp < trigger.playerHpBelow  : true;
      const oppHpMatch  = trigger.opponentHpBelow !== undefined ? newOppHp < trigger.opponentHpBelow : true;
      const emoMatch    = trigger.opponentEmotion !== undefined ? targetEmotion === trigger.opponentEmotion : true;
      // For roundGte beats, only fire trigger if the specific trigger is set; ignore defaults
      const noRoundSet   = trigger.round === undefined;
      const noGteSet     = trigger.roundGte === undefined;
      const noPlrSet     = trigger.playerHpBelow === undefined;
      const noOppSet     = trigger.opponentHpBelow === undefined;
      const noEmoSet     = trigger.opponentEmotion === undefined;
      const allPass =
        (noRoundSet || roundMatch) &&
        (noGteSet   || roundGteMatch) &&
        (noPlrSet   || plrHpMatch) &&
        (noOppSet   || oppHpMatch) &&
        (noEmoSet   || emoMatch);
      if (allPass) {
        newFiredBeats.push(beat.id);
        if (beat.narrative) dlg.push({ id:uid(), isNarrative:true, text:beat.narrative });
        if (beat.opponentLine) dlg.push({ id:uid(), speaker:opponent.name, text:beat.opponentLine, side:'opp', emo:targetEmotion });
      }
    }
  }

  return {
    next: {
      ...state,
      player: { ...player, hp:newPlrHp, history:newHistory, responses:updatedResps, charge:newCharge },
      opponent: { ...opponent, hp:newOppHp, emotion:targetEmotion },
      round:newRound, dialogue:dlg,
      phase: over ? 'gameover' : 'playing',
      isVictory: newOppHp <= 0 && newPlrHp > 0,
      counts: newCounts, combo: newCombo, maxCombo: Math.max(maxCombo, newCombo),
      firedBeats: newFiredBeats,
    },
    events,
  };
};

// ==================== HOOKS ====================

const useShake = (): [number, (intensity?: number) => void] => {
  const [shake, setShake] = useState(0);
  const trigger = useCallback((intensity = 8) => {
    setShake(intensity);
    setTimeout(() => setShake(0), 420);
  }, []);
  return [shake, trigger];
};

const useTypewriter = (text: string, speed = 18): [string, boolean] => {
  const [out, setOut] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    setOut(''); setDone(false);
    if (!text) return;
    let i = 0;
    const tick = () => {
      i++;
      setOut(text.slice(0, i));
      if (i < text.length) timer = setTimeout(tick, speed);
      else setDone(true);
    };
    let timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [text, speed]);
  return [out, done];
};

// ==================== VISUAL COMPONENTS ====================

function Starfield() {
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', zIndex:0 }}>
      <div style={{
        position:'absolute', inset:'-50%',
        background: 'radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.18), transparent 45%), radial-gradient(ellipse at 80% 70%, rgba(236,72,153,0.12), transparent 45%), radial-gradient(ellipse at 50% 50%, rgba(16,185,129,0.08), transparent 60%)',
        animation: 'drift 28s ease-in-out infinite',
      }} />
      {Array.from({ length: 40 }).map((_, i) => {
        const size = 1 + Math.random() * 2;
        const dur = 3 + Math.random() * 5;
        return (
          <div key={i} style={{
            position:'absolute',
            left: `${Math.random()*100}%`,
            top: `${Math.random()*100}%`,
            width: size, height: size, borderRadius: '50%',
            background: 'rgba(255,255,255,0.8)',
            boxShadow: '0 0 4px rgba(255,255,255,0.6)',
            animation: `twinkle ${dur}s ease-in-out infinite`,
            animationDelay: `${Math.random()*5}s`,
          }} />
        );
      })}
      <style>{`
        @keyframes drift { 0%,100%{transform:translate(0,0) rotate(0deg)} 50%{transform:translate(4%,-3%) rotate(5deg)} }
        @keyframes twinkle { 0%,100%{opacity:0.2} 50%{opacity:1} }
        @keyframes floatUp { 0%{transform:translate(-50%,0) scale(0.5); opacity:0} 15%{transform:translate(-50%,-20px) scale(1.3); opacity:1} 100%{transform:translate(-50%,-80px) scale(0.9); opacity:0} }
        @keyframes particleOut { 0%{transform:translate(0,0) scale(1); opacity:1} 100%{transform:translate(var(--dx),var(--dy)) scale(0.2); opacity:0} }
        @keyframes auraPulse { 0%,100%{transform:scale(1); opacity:0.45} 50%{transform:scale(1.12); opacity:0.75} }
        @keyframes shakeX { 0%,100%{transform:translate(0,0)} 20%{transform:translate(var(--sx),var(--sy))} 40%{transform:translate(calc(var(--sx)*-1),calc(var(--sy)*-0.5))} 60%{transform:translate(calc(var(--sx)*0.5),calc(var(--sy)*-1))} 80%{transform:translate(calc(var(--sx)*-0.5),var(--sy))} }
        @keyframes chargePulse { 0%,100%{box-shadow:0 0 0 0 var(--glow)} 50%{box-shadow:0 0 24px 6px var(--glow)} }
        @keyframes ultReady { 0%,100%{transform:translateY(0) scale(1); box-shadow:0 0 20px var(--glow),0 0 40px var(--glow)} 50%{transform:translateY(-2px) scale(1.03); box-shadow:0 0 35px var(--glow),0 0 70px var(--glow)} }
        @keyframes comboPop { 0%{transform:scale(0.3) rotate(-8deg); opacity:0} 40%{transform:scale(1.3) rotate(2deg); opacity:1} 100%{transform:scale(1) rotate(0); opacity:1} }
        @keyframes hpFlash { 0%{background:rgba(239,68,68,0.6)} 100%{background:transparent} }
        @keyframes slideIn { from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes ultimateFlash { 0%{opacity:0} 20%{opacity:1} 100%{opacity:0} }
        @keyframes triumphPop { 0%{transform:scale(0.5); opacity:0} 60%{transform:scale(1.15); opacity:1} 100%{transform:scale(1); opacity:1} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes bossEntry { 0%{transform:scale(3); opacity:0; filter:blur(20px)} 100%{transform:scale(1); opacity:1; filter:blur(0)} }
        @keyframes perkGlow { 0%,100%{box-shadow:0 0 20px var(--pc)} 50%{box-shadow:0 0 40px var(--pc),0 0 60px var(--pc)} }
      `}</style>
    </div>
  );
}

function Particles({ particles }: { particles: Particle[] }) {
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:20 }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position:'absolute', left: p.x, top: p.y,
          width: p.size, height: p.size, borderRadius: '50%',
          background: p.color, boxShadow: `0 0 ${p.size*2}px ${p.color}`,
          // @ts-ignore
          '--dx': `${p.dx}px`, '--dy': `${p.dy}px`,
          animation: `particleOut ${p.duration}ms ease-out forwards`,
        }} />
      ))}
    </div>
  );
}

function FloatingDamage({ numbers }: { numbers: DamageNumber[] }) {
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:30 }}>
      {numbers.map(n => {
        const color = n.eff === 'heal' ? '#4ADE80' : n.isUlt ? '#F472B6' : n.isCrit ? '#FBBF24' : n.eff === 'super' ? '#FB923C' : n.eff === 'weak' ? '#9CA3AF' : '#FFFFFF';
        const size = n.isCrit || n.isUlt ? 28 : n.eff === 'super' ? 22 : 18;
        const prefix = n.eff === 'heal' ? '+' : '-';
        return (
          <div key={n.id} style={{
            position:'absolute', left: n.x, top: n.y, fontSize: size,
            fontWeight: 900, color,
            textShadow: `0 0 10px ${color}, 0 2px 4px rgba(0,0,0,0.6)`,
            fontFamily: 'Impact, sans-serif', letterSpacing: '1px',
            animation: 'floatUp 1400ms ease-out forwards',
            transform: 'translate(-50%, 0)',
          }}>
            {n.isCrit && <span style={{ fontSize: size * 0.6, marginRight: 4 }}>⚡</span>}
            {prefix}{n.value}
          </div>
        );
      })}
    </div>
  );
}

function HpBar({ hp, maxHp, gradient, flash }: { hp: number; maxHp: number; gradient: string; flash?: boolean }) {
  const pct = Math.max(0, (hp/maxHp)*100);
  const color = pct > 55 ? gradient : pct > 28 ? 'linear-gradient(90deg,#F59E0B,#D97706)' : 'linear-gradient(90deg,#EF4444,#DC2626)';
  return (
    <div style={{ position:'relative', background:'rgba(0,0,0,0.5)', borderRadius:6, height:8, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ width:`${pct}%`, height:'100%', background:color, transition:'width 0.6s cubic-bezier(.4,0,.2,1)', borderRadius:6, boxShadow: `0 0 8px ${pct > 55 ? 'rgba(74,222,128,0.4)' : 'rgba(239,68,68,0.5)'}` }} />
      {flash && <div style={{ position:'absolute', inset:0, animation:'hpFlash 0.5s ease-out' }} />}
      <div style={{ position:'absolute', inset:0, display:'flex', pointerEvents:'none' }}>
        {[25,50,75].map(s => (
          <div key={s} style={{ position:'absolute', left:`${s}%`, top:0, bottom:0, width:1, background:'rgba(0,0,0,0.4)' }} />
        ))}
      </div>
    </div>
  );
}

function ChargeBar({ charge, max=100, ultColor }: { charge: number; max?: number; ultColor: string }) {
  const pct = (charge / max) * 100;
  const full = charge >= max;
  return (
    <div style={{ marginTop:4, position:'relative' }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'rgba(255,255,255,0.45)', fontWeight:600, letterSpacing:0.5, marginBottom:2 }}>
        <span>CHARGE</span>
        <span style={{ color: full ? ultColor : undefined }}>{Math.floor(pct)}%</span>
      </div>
      <div style={{
        position:'relative', background:'rgba(0,0,0,0.5)', borderRadius:6, height:5, overflow:'hidden',
        border: `1px solid ${full ? ultColor : 'rgba(255,255,255,0.08)'}`,
        // @ts-ignore
        '--glow': ultColor,
        animation: full ? 'chargePulse 1.2s ease-in-out infinite' : undefined,
      }}>
        <div style={{
          width:`${pct}%`, height:'100%',
          background: full ? `linear-gradient(90deg, ${ultColor}, #fff, ${ultColor})` : `linear-gradient(90deg, ${ultColor}88, ${ultColor})`,
          transition:'width 0.5s ease',
          backgroundSize: full ? '200% 100%' : '100% 100%',
          animation: full ? 'drift 2s linear infinite' : undefined,
        }} />
      </div>
    </div>
  );
}

function ComboCounter({ combo }: { combo: number }) {
  if (combo < 2) return null;
  const size = combo >= 4 ? 44 : combo >= 3 ? 38 : 32;
  const color = combo >= 4 ? '#F472B6' : combo >= 3 ? '#FB923C' : '#FBBF24';
  return (
    <div key={combo} style={{
      position:'absolute', top: 14, left: '50%', transform:'translateX(-50%)',
      fontSize: size, fontWeight: 900, fontFamily: 'Impact, sans-serif',
      color, textShadow: `0 0 16px ${color}, 0 0 32px ${color}, 0 2px 4px rgba(0,0,0,0.8)`,
      letterSpacing:1, animation:'comboPop 400ms cubic-bezier(.3,1.5,.6,1)',
      pointerEvents:'none', zIndex:15, whiteSpace:'nowrap',
    }}>
      COMBO × {combo}
    </div>
  );
}

function Avatar({ char, isOpp, damaged }: { char: PlayerState | OpponentState; isOpp: boolean; damaged?: boolean }) {
  const emo = EMOTIONS[char.emotion] || EMOTIONS.confident;
  const charge = 'charge' in char ? char.charge : undefined;
  const ultimate = 'ultimate' in char ? char.ultimate : undefined;
  return (
    <div style={{ position:'relative', width:160 }}>
      <div style={{
        position:'absolute', left:'50%', top: 40, transform:'translate(-50%, 0)',
        width: 90, height: 90, borderRadius: '50%',
        background: `radial-gradient(circle, ${emo.aura} 0%, transparent 70%)`,
        animation: 'auraPulse 2.4s ease-in-out infinite',
        filter: 'blur(6px)', pointerEvents:'none',
      }} />
      <div style={{
        position:'relative',
        background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:16, padding:10, textAlign:'center',
        transition: 'transform 0.2s',
        transform: damaged ? 'scale(0.96)' : 'scale(1)',
      }}>
        <div style={{ color:'rgba(255,255,255,0.5)', fontSize:10, marginBottom:3, fontWeight:600, letterSpacing:0.5 }}>
          {char.hp}/{char.maxHp} HP
        </div>
        <HpBar hp={char.hp} maxHp={char.maxHp} gradient={isOpp ? 'linear-gradient(90deg,#EF4444,#DC2626)' : 'linear-gradient(90deg,#10B981,#059669)'} flash={damaged} />
        {!isOpp && charge !== undefined && (
          <ChargeBar charge={charge} ultColor={ULTIMATES[ultimate as UltKey]?.color || '#818CF8'} />
        )}
        <div style={{ fontSize:46, margin:'8px 0 4px', filter: `drop-shadow(0 0 14px ${emo.aura})`, transition: 'filter 0.5s' }}>{char.icon}</div>
        <div style={{ color:'white', fontWeight:700, fontSize:12, marginBottom:2, lineHeight:1.2 }}>{char.name}</div>
        <div style={{ color:'#818CF8', fontSize:9, fontWeight:700, marginBottom:6, letterSpacing:0.5, textTransform:'uppercase' }}>{char.archetype}</div>
        <div style={{
          background: `linear-gradient(135deg, ${emo.color}22, ${emo.color}11)`,
          border: `1px solid ${emo.color}44`,
          borderRadius:16, padding:'3px 9px', display:'inline-flex', alignItems:'center', gap:4,
          fontSize:10, color:'white', fontWeight:600, transition: 'all 0.5s',
        }}>
          <span style={{ fontSize:11 }}>{emo.icon}</span>
          <span>{emo.name}</span>
        </div>
      </div>
    </div>
  );
}

function TypewriterBubble({ text, isPlr, speaker, emo, isLatest }: { text: string; isPlr: boolean; speaker?: string; emo?: EmotionKey; isLatest: boolean }) {
  const [out, done] = useTypewriter(isLatest ? text : text, isLatest ? 14 : 0);
  const displayText = isLatest ? out : text;
  const showCursor = isLatest && !done;
  const emoColor = (emo && EMOTIONS[emo]?.color) || (isPlr ? '#60A5FA' : '#F87171');
  const speakerColor = isPlr ? '#93C5FD' : '#FCA5A5';
  return (
    <div style={{ marginBottom:10, textAlign:isPlr?'right':'left', animation: 'slideIn 0.25s ease-out' }}>
      <div style={{ fontSize:10, color:speakerColor, marginBottom:3, fontWeight:700, letterSpacing:0.3 }}>{speaker}</div>
      <div style={{
        display:'inline-block', maxWidth:'82%',
        padding:'9px 13px',
        borderRadius:isPlr?'16px 16px 4px 16px':'16px 16px 16px 4px',
        background: `linear-gradient(135deg, ${emoColor}28, ${emoColor}14)`,
        border:`1px solid ${emoColor}44`,
        color:'rgba(255,255,255,0.93)', fontSize:12.5, lineHeight:1.6, textAlign:'left',
        backdropFilter:'blur(4px)',
        boxShadow: `0 2px 12px ${emoColor}22`,
      }}>
        {displayText}{showCursor && <span style={{ opacity: 0.6 }}>▊</span>}
      </div>
    </div>
  );
}

function DlgLog({ entries, round, combo }: { entries: DialogueEntry[]; round: number; combo: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [entries]);
  const effColors: Record<string, string> = { super:'#4ADE80', normal:'#9CA3AF', weak:'#F87171', combo:'#FBBF24' };
  const lastNonSystemIdx = entries.map((e,i) => e.isSystem ? -1 : i).filter(i => i >= 0).pop();
  return (
    <div style={{ position:'relative' }}>
      <ComboCounter combo={combo} />
      <div ref={ref} style={{
        height:260, overflowY:'auto', padding:'16px 18px',
        borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)',
        background:'linear-gradient(180deg, rgba(15,23,42,0.4), rgba(2,6,23,0.4))',
        backdropFilter:'blur(8px)',
      }}>
        <div style={{ textAlign:'right', color:'rgba(255,255,255,0.35)', fontSize:11, marginBottom:10, fontWeight:600, letterSpacing:1 }}>ROUND {round}</div>
        {entries.length === 0 && (
          <div style={{ textAlign:'center', color:'rgba(255,255,255,0.4)', marginTop:70, fontSize:13, animation:'fadeIn 0.4s' }}>
            Choose a response below to begin...
          </div>
        )}
        {entries.map((e, i) => {
          if (e.isNarrative) {
            return (
              <div key={e.id} style={{
                textAlign:'center', margin:'12px 0', padding:'8px 16px',
                fontSize:11.5, fontStyle:'italic',
                color:'rgba(255,255,255,0.45)',
                letterSpacing:0.2, lineHeight:1.7,
                borderTop:'1px solid rgba(255,255,255,0.05)',
                borderBottom:'1px solid rgba(255,255,255,0.05)',
                animation:'slideIn 0.4s ease-out',
              }}>{e.text}</div>
            );
          }
          if (e.isSystem) {
            const isCritOrUlt = e.isCrit || e.isUlt;
            return (
              <div key={e.id} style={{
                textAlign:'center', margin:'8px 0', padding:'4px 10px',
                fontSize: isCritOrUlt ? 13 : 11,
                fontWeight: isCritOrUlt ? 800 : 600,
                color: effColors[e.eff ?? ''] || '#9CA3AF',
                fontStyle: isCritOrUlt ? 'normal' : 'italic',
                textShadow: isCritOrUlt ? `0 0 12px ${effColors[e.eff ?? ''] || '#9CA3AF'}` : undefined,
                letterSpacing: isCritOrUlt ? 1.5 : 0.3,
                animation: 'slideIn 0.3s ease-out',
              }}>{e.text}</div>
            );
          }
          return <TypewriterBubble key={e.id} text={e.text} isPlr={e.side==='plr'} speaker={e.speaker} emo={e.emo} isLatest={i === lastNonSystemIdx} />;
        })}
      </div>
    </div>
  );
}

function RespBar({ responses, onResp, onUltimate, opponent, disabled, charge, ult, playerId, scenarioId }: {
  responses: RespType[];
  onResp: (type: RespType) => void;
  onUltimate: () => void;
  opponent: OpponentState;
  disabled: boolean;
  charge: number;
  ult: typeof ULTIMATES[UltKey];
  playerId: string;
  scenarioId: string;
}) {
  const [hov, setHov] = useState<RespType | null>(null);
  const ultReady = charge >= 100;
  const notes = getFieldNotes();
  return (
    <div style={{ padding:'14px 16px 16px', background:'rgba(0,0,0,0.25)' }}>
      <div style={{ textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:10, marginBottom:10, letterSpacing:1.5, textTransform:'uppercase', fontWeight:600 }}>
        Choose Your Response
      </div>
      <button
        onClick={() => ultReady && !disabled && onUltimate()}
        disabled={!ultReady || disabled}
        style={{
          width:'100%', marginBottom:8,
          background: ultReady ? ult.gradient : 'rgba(255,255,255,0.04)',
          border: `1px solid ${ultReady ? ult.color : 'rgba(255,255,255,0.08)'}`,
          borderRadius:10, padding:'8px 12px',
          color: ultReady ? 'white' : 'rgba(255,255,255,0.35)',
          fontWeight:700, fontSize:12,
          cursor: ultReady && !disabled ? 'pointer' : 'not-allowed',
          opacity: disabled ? 0.5 : 1,
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
          transition:'all 0.2s',
          // @ts-ignore
          '--glow': ultReady ? `${ult.color}aa` : 'transparent',
          animation: ultReady && !disabled ? 'ultReady 1.4s ease-in-out infinite' : undefined,
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20, filter: ultReady ? `drop-shadow(0 0 8px ${ult.color})` : undefined }}>{ult.icon}</span>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:12, fontWeight:800, letterSpacing:0.5 }}>{ult.name}</div>
            <div style={{ fontSize:9.5, opacity:0.85, fontWeight:500 }}>
              {ultReady ? ult.tagline : `${Math.floor(charge)}% charged`}
            </div>
          </div>
        </div>
        <div style={{
          fontSize:10, fontWeight:800, padding:'3px 8px',
          background: ultReady ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.05)',
          borderRadius:6, letterSpacing:1,
        }}>
          {ultReady ? 'UNLEASH' : 'LOCKED'}
        </div>
      </button>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(responses.length,2)},1fr)`, gap:8 }}>
        {responses.map(type => {
          const cfg = RESP[type];
          const isHov = hov === type;
          const preview = previewPlayerLine(scenarioId, playerId, type, (PLAYER_DLG as Record<string, Partial<Record<RespType, string>>>)[playerId]?.[type] || '');
          const learnedEff = notes[`${opponent.emotion}:${type}`] as Eff | undefined;
          const lg = learnedEff ? EFF_GLYPH[learnedEff] : null;
          return (
            <button
              key={type}
              onClick={() => !disabled && onResp(type)}
              onMouseEnter={() => setHov(type)}
              onMouseLeave={() => setHov(null)}
              disabled={disabled}
              style={{
                textAlign:'left',
                background: isHov && !disabled
                  ? `linear-gradient(135deg, ${cfg.color}28, ${cfg.color}12)`
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isHov && !disabled ? cfg.color + 'aa' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 12,
                padding: '11px 13px',
                color: 'rgba(255,255,255,0.94)',
                fontWeight: 500,
                fontSize: 12,
                lineHeight: 1.5,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'transform 0.15s, box-shadow 0.15s, background 0.2s',
                transform: isHov && !disabled ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isHov && !disabled ? `0 8px 24px ${cfg.color}33` : '0 2px 6px rgba(0,0,0,0.25)',
                display:'flex', alignItems:'flex-start', gap: 10,
                position:'relative', overflow:'hidden',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1, filter: `drop-shadow(0 0 6px ${cfg.color}66)` }}>{cfg.icon}</span>
              <span style={{ flex: 1 }}>{preview}</span>
              {lg && (
                <span
                  title={`You've learned: ${lg.label} on ${EMOTIONS[opponent.emotion]?.name || opponent.emotion}`}
                  style={{
                    position:'absolute', top:6, right:8, fontSize:14, fontWeight:800,
                    color: lg.color, lineHeight:1,
                    textShadow:`0 0 8px ${lg.color}88`, pointerEvents:'none',
                  }}
                >{lg.glyph}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StageIndicator({ currentStage, stages }: { currentStage: number; stages: StageDef[] }) {
  return (
    <div style={{ display:'flex', gap:8, justifyContent:'center', alignItems:'center', padding:'6px 0' }}>
      <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)', fontWeight:700, letterSpacing:1, marginRight:4 }}>ASCENT</span>
      {stages.map((s, i) => {
        const n = i + 1;
        const isActive = n === currentStage;
        const isDone = n < currentStage;
        const isBoss = s.isBoss;
        const dotColor = isActive ? (isBoss ? '#EF4444' : '#818CF8') : isDone ? '#4ADE80' : 'rgba(255,255,255,0.2)';
        return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{
              padding: isActive ? '3px 10px' : '3px 8px',
              fontSize: 10, fontWeight: 800, borderRadius: 10,
              background: isActive ? (isBoss ? 'linear-gradient(135deg,#EF4444,#DC2626)' : 'linear-gradient(135deg,#6366F1,#4F46E5)') : isDone ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
              color: isActive ? 'white' : isDone ? '#4ADE80' : 'rgba(255,255,255,0.35)',
              border: `1px solid ${dotColor}`,
              boxShadow: isActive ? `0 0 12px ${dotColor}66` : 'none',
              transition: 'all 0.3s',
            }}>
              {isDone ? '✓' : isBoss ? '👑' : n}
            </div>
            {i < stages.length - 1 && <div style={{ width:16, height:1, background: isDone ? '#4ADE8044' : 'rgba(255,255,255,0.1)' }} />}
          </div>
        );
      })}
    </div>
  );
}

function PerkBadges({ perks, compact=false }: { perks: PerkId[]; compact?: boolean }) {
  if (!perks || perks.length === 0) return null;
  return (
    <div style={{ display:'flex', gap:4, flexWrap:'wrap', justifyContent:'center' }}>
      {perks.map(id => {
        const p = PERKS[id as PerkId]; if (!p) return null;
        return (
          <div key={id} title={p.desc} style={{
            padding: compact ? '2px 6px' : '3px 8px',
            fontSize: compact ? 9 : 10,
            borderRadius: 10,
            background: `${p.color}22`, border: `1px solid ${p.color}66`,
            color: 'white', display: 'flex', alignItems: 'center', gap: 4, fontWeight:600,
          }}>
            <span>{p.icon}</span>{!compact && <span>{p.name}</span>}
          </div>
        );
      })}
    </div>
  );
}

function TutorialCoach({ step, total, content, onContinue }: { step: number; total: number; content: { title: string; body: string; isFinal?: boolean }; onContinue: () => void }) {
  return (
    <div style={{
      position:'absolute', inset:0,
      background:'radial-gradient(ellipse at center, rgba(251,191,36,0.08), rgba(0,0,0,0.88))',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:70, animation:'fadeIn 0.3s', borderRadius:20, padding:20,
    }}>
      <div style={{
        background:'linear-gradient(180deg,#1E293B,#0F172A)',
        border:'1px solid rgba(251,191,36,0.4)',
        borderRadius:20, padding:24, maxWidth:400, width:'100%', textAlign:'center',
        boxShadow:'0 20px 60px rgba(251,191,36,0.15), 0 0 100px rgba(251,191,36,0.1)',
        animation:'slideIn 0.35s ease-out',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
          <div style={{
            width:52, height:52, borderRadius:'50%',
            background:'linear-gradient(135deg,#FBBF24,#F59E0B)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:30,
            boxShadow:'0 0 20px rgba(251,191,36,0.5)',
            flexShrink:0,
          }}>🏀</div>
          <div style={{ textAlign:'left', flex:1 }}>
            <div style={{ color:'#FBBF24', fontSize:10, fontWeight:800, letterSpacing:1.5 }}>COACH RILEY</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:600, letterSpacing:0.5, marginTop:2 }}>
              LESSON {step} OF {total}
            </div>
          </div>
        </div>
        <h3 style={{
          color:'white', fontSize:18, fontWeight:800, margin:'0 0 10px',
          textAlign:'left', letterSpacing:-0.3,
        }}>{content.title}</h3>
        <p style={{
          color:'rgba(255,255,255,0.75)', fontSize:13, lineHeight:1.7,
          margin:'0 0 18px', textAlign:'left',
        }}>{content.body}</p>
        <button onClick={onContinue} style={{
          width:'100%', padding:'11px 0',
          background:'linear-gradient(135deg,#FBBF24,#F59E0B)', border:'none',
          borderRadius:10, color:'#0F172A', fontWeight:800, fontSize:13,
          cursor:'pointer', letterSpacing:0.8,
          boxShadow:'0 6px 20px rgba(251,191,36,0.4)',
          transition:'transform 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; }}
        >
          {content.isFinal ? "GRADUATE ✓" : "CONTINUE →"}
        </button>
      </div>
    </div>
  );
}

function InstructionBanner({ text }: { text: string }) {
  return (
    <div style={{
      margin:'0 16px 10px',
      padding:'10px 14px',
      background:'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(251,191,36,0.08))',
      border:'1px solid rgba(251,191,36,0.4)',
      borderRadius:10,
      fontSize:12, lineHeight:1.55,
      color:'rgba(255,255,255,0.9)',
      display:'flex', gap:10, alignItems:'flex-start',
      animation:'slideIn 0.3s ease-out',
    }}>
      <span style={{ fontSize:16, lineHeight:1 }}>🏀</span>
      <span style={{ flex:1 }}>{text}</span>
    </div>
  );
}

function CharSelect({ onSelect, onExit = null }: { onSelect: (id: string) => void; onExit?: (() => void) | null }) {
  const [hov, setHov] = useState<string | null>(null);
  const chars = (Object.values(CHARS) as CharDef[]);
  return (
    <div style={{ maxWidth:820, margin:'0 auto', padding:24, position:'relative', zIndex:2 }}>
      {onExit && (
        <button onClick={onExit} style={{
          background:'transparent', border:'1px solid rgba(255,255,255,0.14)',
          borderRadius:8, padding:'6px 14px', color:'rgba(255,255,255,0.45)',
          fontSize:11, cursor:'pointer', fontWeight:600, marginBottom:18,
          letterSpacing:0.3, transition:'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color='white'; e.currentTarget.style.borderColor='rgba(255,255,255,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.14)'; }}
        >← Back to Velvet</button>
      )}
      <div style={{ textAlign:'center', marginBottom:28, animation:'fadeIn 0.5s' }}>
        <div style={{ fontSize:52, marginBottom:8, filter:'drop-shadow(0 0 20px rgba(99,102,241,0.5))' }}>🧠</div>
        <h1 style={{
          color:'white', fontSize:30, fontWeight:900, margin:'0 0 8px',
          background: 'linear-gradient(135deg, #fff 20%, #818CF8 60%, #EC4899 100%)',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          letterSpacing: '-0.5px',
        }}>Social Combat RPG</h1>
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:14, margin:0 }}>
          Master the art of conversation. Choose your archetype.
        </p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        {chars.map((c, i) => {
          const ult = ULTIMATES[c.ultimate];
          const isHov = hov === c.id;
          return (
            <div key={c.id}
              onClick={() => onSelect(c.id)}
              onMouseEnter={() => setHov(c.id)}
              onMouseLeave={() => setHov(null)}
              style={{
                backdropFilter:'blur(10px)',
                border: `1px solid ${isHov ? ult.color + 'aa' : 'rgba(255,255,255,0.08)'}`,
                borderRadius:16, padding:20, textAlign:'center', cursor:'pointer',
                transition:'all 0.25s',
                background: isHov ? `linear-gradient(180deg, ${ult.color}18, rgba(255,255,255,0.04))` : 'rgba(255,255,255,0.04)',
                transform: isHov ? 'translateY(-3px)' : 'translateY(0)',
                boxShadow: isHov ? `0 12px 40px ${ult.color}55` : '0 4px 16px rgba(0,0,0,0.3)',
                animation: `fadeIn 0.4s ease-out ${i*0.08}s backwards`,
              }}
            >
              <div style={{ fontSize:50, marginBottom:10, filter: isHov ? `drop-shadow(0 0 20px ${ult.color})` : 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))', transition:'filter 0.3s' }}>{c.icon}</div>
              <div style={{ color:'white', fontWeight:800, fontSize:16, marginBottom:3 }}>{c.name}</div>
              <div style={{ color: ult.color, fontSize:11, fontWeight:700, marginBottom:12, letterSpacing:0.5, textTransform:'uppercase' }}>{c.archetype}</div>
              <div style={{ color:'rgba(255,255,255,0.6)', fontSize:12, marginBottom:14, lineHeight:1.55, minHeight: 58 }}>{c.description}</div>
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:12, marginBottom:12, textAlign:'left' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5, padding:'4px 8px', background: `${ult.color}15`, borderRadius:6, border:`1px solid ${ult.color}33` }}>
                  <span style={{ fontSize:14 }}>{ult.icon}</span>
                  <div>
                    <div style={{ color:ult.color, fontSize:10.5, fontWeight:800, letterSpacing:0.3 }}>{ult.name}</div>
                    <div style={{ color:'rgba(255,255,255,0.55)', fontSize:9, lineHeight:1.3 }}>{ult.desc}</div>
                  </div>
                </div>
                {c.strongResponses.map(r => (
                  <div key={r} style={{ color:'#4ADE80', fontSize:10.5, marginBottom:2, fontWeight:600 }}>✦ Strong: {RESP[r]?.label}</div>
                ))}
                {c.weakResponses.map(r => (
                  <div key={r} style={{ color:'#F87171', fontSize:10.5, marginBottom:2, fontWeight:600 }}>✧ Weak: {RESP[r]?.label}</div>
                ))}
              </div>
              <button style={{
                width:'100%', padding:'11px 0',
                background: isHov ? ult.gradient : 'rgba(99,102,241,0.2)',
                border: `1px solid ${isHov ? ult.color : 'rgba(99,102,241,0.4)'}`,
                borderRadius:10, color:'white', fontWeight:800, fontSize:13,
                cursor:'pointer', transition:'all 0.2s', letterSpacing:0.5,
              }}>SELECT</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModeSelect({ char, onTutorial, onSingle, onAscent, onBack }: {
  char: CharDef;
  onTutorial: () => void;
  onSingle: () => void;
  onAscent: () => void;
  onBack: () => void;
}) {
  const [hov, setHov] = useState<string | null>(null);
  const cards = [
    { id:'t', onClick:onTutorial, icon:'🏀', title:'Tutorial', desc:'Learn the ropes with Coach Riley — no stakes, just teaching.', time:'~3 MIN', color:'#FBBF24', timeColor:'#FBBF24' },
    { id:'s', onClick:onSingle, icon:'⚔️', title:'Single Scenario', desc:'One opponent. One conversation. Master it at your pace.', time:'~5 MIN', color:'#6366F1', timeColor:'#818CF8' },
    { id:'a', onClick:onAscent, icon:'🏔️', title:'Ascent Mode', desc:'Three escalating conflicts. Earn perks. Face a boss.', time:'~15 MIN • HARDCORE', color:'#EC4899', timeColor:'#F472B6', badge:'NEW' },
  ];
  return (
    <div style={{ padding:'28px 24px 32px', maxWidth:740, margin:'0 auto', position:'relative', zIndex:2, animation:'fadeIn 0.4s' }}>
      <button onClick={onBack} style={{
        background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
        borderRadius:8, padding:'6px 14px', color:'rgba(255,255,255,0.7)',
        fontSize:12, cursor:'pointer', marginBottom:20, fontWeight:600,
      }}>← Back</button>
      <div style={{ textAlign:'center', marginBottom:26 }}>
        <div style={{ fontSize:52, marginBottom:8, filter:'drop-shadow(0 0 20px rgba(99,102,241,0.4))' }}>{char.icon}</div>
        <div style={{ color:'rgba(255,255,255,0.45)', fontSize:10, fontWeight:700, letterSpacing:2 }}>PLAYING AS</div>
        <h2 style={{ color:'white', fontSize:22, fontWeight:900, margin:'4px 0 0' }}>{char.name}</h2>
      </div>
      <div style={{ color:'white', textAlign:'center', fontSize:16, fontWeight:700, marginBottom:16, letterSpacing:0.3 }}>
        Choose Your Mode
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
        {cards.map(c => {
          const isHov = hov === c.id;
          return (
            <div key={c.id} onClick={c.onClick}
              onMouseEnter={() => setHov(c.id)} onMouseLeave={() => setHov(null)}
              style={{
                background: isHov ? `linear-gradient(180deg, ${c.color}26, rgba(255,255,255,0.04))` : 'rgba(255,255,255,0.04)',
                border:`1px solid ${isHov ? c.color : 'rgba(255,255,255,0.1)'}`,
                borderRadius:14, padding:'18px 14px', cursor:'pointer', textAlign:'center',
                transition:'all 0.2s',
                transform: isHov ? 'translateY(-3px)' : 'translateY(0)',
                boxShadow: isHov ? `0 12px 36px ${c.color}66` : '0 4px 12px rgba(0,0,0,0.3)',
                position:'relative',
              }}>
              {c.badge && (
                <div style={{
                  position:'absolute', top:8, right:8,
                  background:`linear-gradient(135deg,${c.color},#EC4899)`,
                  fontSize:8, fontWeight:800, padding:'2px 6px', borderRadius:5,
                  letterSpacing:0.8, color:'white',
                }}>{c.badge}</div>
              )}
              <div style={{ fontSize:40, marginBottom:8 }}>{c.icon}</div>
              <div style={{ color:'white', fontSize:15, fontWeight:800, marginBottom:6 }}>{c.title}</div>
              <div style={{ color:'rgba(255,255,255,0.6)', fontSize:11, lineHeight:1.55, marginBottom:10, minHeight:48 }}>
                {c.desc}
              </div>
              <div style={{ color:c.timeColor, fontSize:10, fontWeight:700, letterSpacing:0.5 }}>{c.time}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PerkSelect({ options, stage, nextStage, currentPerks, onPick, isBoss }: {
  options: PerkOption[];
  stage: number;
  nextStage: number;
  currentPerks: PerkId[];
  onPick: (id: PerkId) => void;
  isBoss?: boolean;
}) {
  const [hov, setHov] = useState<PerkId | null>(null);
  const [picked, setPicked] = useState<PerkId | null>(null);
  const handle = (id: PerkId) => {
    if (picked) return;
    setPicked(id);
    setTimeout(() => onPick(id), 500);
  };
  return (
    <div style={{ padding:'32px 26px', textAlign:'center', animation:'fadeIn 0.4s', position:'relative', zIndex:2 }}>
      <div style={{ color:'#4ADE80', fontSize:11, fontWeight:800, letterSpacing:2.5, marginBottom:6, textTransform:'uppercase' }}>
        ✓ Stage {stage} Complete
      </div>
      <h2 style={{
        color:'white', fontSize:28, fontWeight:900, margin:'0 0 8px',
        background:'linear-gradient(135deg, #fff 20%, #FBBF24 70%, #F472B6 100%)',
        WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
        letterSpacing:-0.5,
      }}>Choose Your Edge</h2>
      <p style={{ color:'rgba(255,255,255,0.55)', fontSize:13, margin:'0 0 16px' }}>
        Pick one perk to carry into Stage {nextStage}{isBoss ? ' — the boss' : ''}.
      </p>
      {currentPerks.length > 0 && (
        <div style={{ marginBottom:22 }}>
          <div style={{ color:'rgba(255,255,255,0.4)', fontSize:9, fontWeight:700, letterSpacing:1.5, marginBottom:6 }}>ACTIVE PERKS</div>
          <PerkBadges perks={currentPerks} />
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {options.map((p, i) => {
          const isHov = hov === p.id;
          const isPicked = picked === p.id;
          const isDimmed = picked && picked !== p.id;
          return (
            <div key={p.id}
              onClick={() => handle(p.id)}
              onMouseEnter={() => setHov(p.id)}
              onMouseLeave={() => setHov(null)}
              style={{
                background: isHov || isPicked ? `linear-gradient(180deg, ${p.color}28, ${p.color}08)` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isHov || isPicked ? p.color : 'rgba(255,255,255,0.1)'}`,
                borderRadius:16, padding:18, cursor: picked ? 'default' : 'pointer',
                transition:'all 0.25s',
                transform: isPicked ? 'scale(1.06)' : isHov && !picked ? 'translateY(-4px)' : 'translateY(0)',
                boxShadow: isPicked ? `0 0 50px ${p.color}, 0 0 80px ${p.color}44` : isHov ? `0 12px 40px ${p.color}66` : '0 4px 16px rgba(0,0,0,0.3)',
                opacity: isDimmed ? 0.3 : 1,
                animation: `fadeIn 0.4s ease-out ${i*0.1}s backwards`,
                // @ts-ignore
                '--pc': `${p.color}66`,
              }}
            >
              <div style={{
                width:60, height:60, borderRadius:'50%',
                background: `linear-gradient(135deg, ${p.color}, ${p.color}88)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                margin:'0 auto 12px', fontSize:30,
                boxShadow: isHov || isPicked ? `0 0 30px ${p.color}` : `0 4px 16px ${p.color}66`,
                transition:'all 0.25s',
              }}>{p.icon}</div>
              <div style={{ color:'white', fontSize:14, fontWeight:800, marginBottom:6 }}>{p.name}</div>
              <div style={{ color:'rgba(255,255,255,0.7)', fontSize:11.5, lineHeight:1.55, minHeight:54 }}>{p.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScenarioIntro({ scenario, onStart, isBoss, memory }: {
  scenario: Scenario;
  onStart: () => void;
  isBoss?: boolean;
  memory: CombatMemory | null;
}) {
  const [cd, setCd] = useState(5);
  useEffect(() => {
    if (cd <= 0) { onStart(); return; }
    const t = setTimeout(() => setCd(c => c-1), 1000);
    return () => clearTimeout(t);
  }, [cd, onStart]);
  const rapport = memory?.rapport ?? 0;
  const timesFaced = memory?.times_faced ?? 0;
  const rapportLabel = rapport >= 2 ? 'WARM' : rapport <= -2 ? 'ICY' : timesFaced > 0 ? 'NEUTRAL' : null;
  const rapportColor = rapport >= 2 ? '#4ADE80' : rapport <= -2 ? '#F87171' : '#94A3B8';
  return (
    <div style={{ padding:'44px 32px', textAlign:'center', maxWidth:580, margin:'0 auto', animation:'fadeIn 0.4s' }}>
      {isBoss && (
        <div style={{
          color:'#EF4444', fontSize:11, fontWeight:900, letterSpacing:4, marginBottom:12,
          textShadow:'0 0 20px rgba(239,68,68,0.6)',
          animation:'fadeIn 0.8s',
        }}>
          ⚠ FINAL STAGE ⚠
        </div>
      )}
      <div style={{
        fontSize:64, marginBottom:14,
        filter: `drop-shadow(0 0 28px ${isBoss ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.5)'})`,
        animation: isBoss ? 'bossEntry 0.8s ease-out' : undefined,
      }}>{scenario.opponent.icon}</div>
      <div style={{ color: isBoss ? '#F87171' : '#F87171', fontSize:11, fontWeight:800, letterSpacing:2.5, marginBottom:8, textTransform:'uppercase' }}>
        {scenario.opponent.archetype}
      </div>
      <div style={{ color:'white', fontSize:20, fontWeight:800, marginBottom:6 }}>{scenario.opponent.name}</div>
      {rapportLabel && (
        <div style={{
          display:'inline-flex', alignItems:'center', gap:6,
          marginBottom: 10,
          padding: '4px 10px',
          background: `${rapportColor}14`, border: `1px solid ${rapportColor}55`,
          borderRadius: 12, fontSize: 10, fontWeight: 700, letterSpacing: 1,
          color: rapportColor,
        }}>
          <span>HISTORY:</span>
          <span>{rapportLabel}</span>
          <span style={{ opacity: 0.65 }}>· {timesFaced} prior {timesFaced === 1 ? 'meeting' : 'meetings'}</span>
        </div>
      )}
      {isBoss && scenario.opponent.specialDesc && (
        <div style={{
          display:'inline-block',
          background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.4)',
          borderRadius:10, padding:'6px 12px', marginBottom:14,
          color:'#FCA5A5', fontSize:11, fontWeight:700, letterSpacing:0.3,
        }}>
          ⚡ {scenario.opponent.specialDesc}
        </div>
      )}
      <div style={{ color:'rgba(255,255,255,0.75)', fontSize:14, lineHeight:1.75, marginBottom:26 }}>{scenario.setup}</div>
      <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
        <button onClick={onStart} style={{
          background: isBoss ? 'linear-gradient(135deg,#EF4444,#DC2626)' : 'linear-gradient(135deg,#6366F1,#4F46E5)',
          border:'none', borderRadius:10,
          padding:'12px 28px', color:'white', fontWeight:800, cursor:'pointer', fontSize:14,
          boxShadow: isBoss ? '0 6px 20px rgba(239,68,68,0.5)' : '0 6px 20px rgba(99,102,241,0.5)', letterSpacing:0.5,
          transition:'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; }}
        >
          {isBoss ? 'FACE THE BOSS' : 'BEGIN NOW'}
        </button>
        <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 20px', color:'rgba(255,255,255,0.5)', fontSize:14, fontWeight:600 }}>
          Auto-starts in {cd}s
        </div>
      </div>
    </div>
  );
}

function StageClear({ stage, isBoss }: { stage: number; isBoss?: boolean }) {
  return (
    <div style={{
      position:'absolute', inset:0,
      background:'radial-gradient(circle, rgba(74,222,128,0.2), rgba(0,0,0,0.88))',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:60, animation:'fadeIn 0.3s', borderRadius:20,
    }}>
      <div style={{ textAlign:'center', animation:'triumphPop 0.6s cubic-bezier(.3,1.5,.6,1)' }}>
        <div style={{ fontSize:74, marginBottom:8, filter:'drop-shadow(0 0 24px rgba(74,222,128,0.7))' }}>✓</div>
        <div style={{
          color:'#4ADE80', fontSize:30, fontWeight:900, letterSpacing:2,
          textShadow:'0 0 24px rgba(74,222,128,0.7)',
          marginBottom:10,
        }}>
          STAGE {stage} COMPLETE
        </div>
        <div style={{ color:'rgba(255,255,255,0.6)', fontSize:13, fontWeight:600, letterSpacing:0.5 }}>
          {isBoss ? 'Claiming victory...' : 'Earning your edge...'}
        </div>
      </div>
    </div>
  );
}

function GameOver({ state, ascent, onRestart, onNewChallenge, onNewGame, onRetryStage, onAbandonRun }: {
  state: GameState;
  ascent: AscentRun | null;
  onRestart: () => void;
  onNewChallenge: () => void;
  onNewGame: () => void;
  onRetryStage: () => void;
  onAbandonRun: () => void;
}) {
  const { isVictory, counts, round, player, opponent, maxCombo, scenario } = state;
  const topResp = Object.entries(counts).filter(([k]) => k !== 'ultimate').sort((a,b) => b[1]-a[1])[0]?.[0];
  const tip = topResp ? (TIPS as Record<string, string>)[topResp] : null;
  const usedUlt = (counts.ultimate || 0) > 0;
  const isAscent = !!ascent;

  const conflictId = scenario?.conflictId || (scenario?.id ? parseConflictId(scenario.id) : null);
  const summary = summarizeObjectives(state);
  const objectives = conflictId ? (CONFLICT_OBJECTIVES[conflictId] || []) : [];
  const ending = conflictId ? pickEnding(conflictId, summary) : null;

  const bStyle = (bg: string, border: string, color: string): CSSProperties => ({
    width:'100%', padding:'12px 0', background:bg, border, borderRadius:10,
    color, fontWeight:700, fontSize:13, cursor:'pointer', letterSpacing:0.5,
    transition:'all 0.15s',
  });

  return (
    <div style={{
      position:'absolute', inset:0,
      background:'radial-gradient(ellipse at center, rgba(0,0,0,0.9), rgba(0,0,0,0.98))',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, borderRadius:20,
      animation:'fadeIn 0.4s',
    }}>
      <div style={{
        background:'linear-gradient(180deg,#1E293B,#0F172A)',
        border: `1px solid ${isVictory ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}`,
        borderRadius:20, padding:26, maxWidth:380, width:'90%', textAlign:'center',
        boxShadow: `0 20px 60px ${isVictory ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
        animation: 'slideIn 0.4s ease-out',
      }}>
        <div style={{ fontSize:54, marginBottom:6, filter: `drop-shadow(0 0 24px ${isVictory ? 'rgba(74,222,128,0.6)' : 'rgba(248,113,113,0.6)'})` }}>
          {isVictory?'🏆':'💔'}
        </div>
        <h2 style={{
          color:isVictory?'#4ADE80':'#F87171',
          fontSize:22, fontWeight:900, margin:'0 0 6px', letterSpacing:-0.5,
          textShadow: `0 0 20px ${isVictory ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)'}`,
        }}>
          {ending?.title || (isVictory ? 'SITUATION RESOLVED' : 'OVERWHELMED')}
        </h2>
        <p style={{ color:'rgba(255,255,255,0.72)', fontSize:12.5, marginBottom:14, lineHeight:1.7, fontStyle: ending ? 'italic' : 'normal' }}>
          {ending?.body || (isVictory
            ? "You navigated the social conflict with skill. Your choices made all the difference."
            : isAscent
              ? `Your resilience broke on stage ${ascent.stage}. Retry to keep your perks, or abandon the ascent.`
              : "Your resilience hit its limit. Every loss is a lesson — try a different approach.")}
        </p>
        {objectives.length > 0 && (
          <div style={{ background:'rgba(0,0,0,0.3)', borderRadius:12, padding:12, marginBottom:12, border:'1px solid rgba(255,255,255,0.06)', textAlign:'left' }}>
            <div style={{ color:'rgba(255,255,255,0.45)', fontSize:9, fontWeight:800, letterSpacing:1.5, marginBottom:8 }}>OBJECTIVES</div>
            {objectives.map(o => {
              const done = o.check(summary);
              return (
                <div key={o.id} style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:5, fontSize:11.5, color: done ? '#4ADE80' : 'rgba(255,255,255,0.55)' }}>
                  <span style={{ width: 14, flexShrink: 0, fontWeight:800 }}>{done ? '✓' : '○'}</span>
                  <span style={{ flex: 1, fontWeight: done ? 700 : 500 }}>{o.label}</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ background:'rgba(0,0,0,0.3)', borderRadius:12, padding:12, marginBottom:12, border:'1px solid rgba(255,255,255,0.06)' }}>
          {([
                       ['Rounds Played', String(round - 1)],
            ['Your HP', `${player.hp}/${player.maxHp}`],
            ['Opponent HP', `${opponent.hp}/${opponent.maxHp}`],
            ['Max Combo', `×${maxCombo}`],
            ['Ultimate Used', usedUlt ? '✓' : '✗'],
          ] as [string, string][]).map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:11.5 }}>
              <span style={{ color:'rgba(255,255,255,0.45)' }}>{l}</span>
              <span style={{ color:'white', fontWeight:700 }}>{v}</span>
            </div>
          ))}
        </div>
        {tip && !isAscent && (
          <div style={{
            background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.3)',
            borderRadius:12, padding:11, marginBottom:14,
            fontSize:11, color:'rgba(255,255,255,0.7)', lineHeight:1.65, textAlign:'left',
          }}>
            {tip}
          </div>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {isAscent && !isVictory && (
            <>
              <button onClick={onRetryStage} style={bStyle('linear-gradient(135deg,#F472B6,#EC4899)','none','white')}>
                🔄 Retry Stage {ascent.stage} (keep perks)
              </button>
              <button onClick={onAbandonRun} style={bStyle('rgba(255,255,255,0.06)','1px solid rgba(255,255,255,0.15)','white')}>
                ↩ Abandon Run
              </button>
            </>
          )}
          {!isAscent && (
            <>
              <button onClick={onRestart} style={bStyle('rgba(255,255,255,0.06)','1px solid rgba(255,255,255,0.15)','white')}>🔄 Try This Scenario Again</button>
              <button onClick={onNewChallenge} style={bStyle('linear-gradient(135deg,#8B5CF6,#7C3AED)','none','white')}>⚡ New Challenge</button>
              <button onClick={onNewGame} style={bStyle('transparent','1px solid rgba(99,102,241,0.4)','#818CF8')}>← Choose Different Character</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RunVictory({ ascent, finalState, onNewRun, onMainMenu }: {
  ascent: AscentRun;
  finalState: GameState;
  onNewRun: () => void;
  onMainMenu: () => void;
}) {
  const totalRounds = ascent.totalRounds + (finalState.round - 1);
  const maxCombo = Math.max(ascent.maxCombo, finalState.maxCombo);
  const bossName = ascent.stages[2].opponent.name;

  return (
    <div style={{
      position:'absolute', inset:0,
      background:'radial-gradient(ellipse at center, rgba(251,191,36,0.15), rgba(0,0,0,0.97))',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, borderRadius:20,
      animation:'fadeIn 0.6s',
    }}>
      <div style={{
        background:'linear-gradient(180deg,#1E293B,#0F172A)',
        border:'1px solid rgba(251,191,36,0.5)',
        borderRadius:20, padding:28, maxWidth:420, width:'90%', textAlign:'center',
        boxShadow:'0 20px 80px rgba(251,191,36,0.3), 0 0 120px rgba(251,191,36,0.15)',
        animation:'triumphPop 0.7s cubic-bezier(.3,1.5,.6,1)',
      }}>
        <div style={{
          fontSize:70, marginBottom:10,
          filter:'drop-shadow(0 0 30px rgba(251,191,36,0.8))',
        }}>👑</div>
        <div style={{ color:'#FBBF24', fontSize:11, fontWeight:900, letterSpacing:3.5, marginBottom:4 }}>ASCENT COMPLETE</div>
        <h2 style={{
          color:'white', fontSize:30, fontWeight:900, margin:'0 0 6px',
          background:'linear-gradient(135deg, #FBBF24, #F472B6, #818CF8, #FBBF24)',
          backgroundSize:'200% auto',
          WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          animation:'shimmer 3s linear infinite',
          letterSpacing:-0.5,
        }}>MASTERFUL</h2>
        <p style={{ color:'rgba(255,255,255,0.7)', fontSize:13, marginBottom:18, lineHeight:1.65 }}>
          You conquered all three stages and bested <strong style={{ color:'white' }}>{bossName}</strong>. Few make it this far.
        </p>
        <div style={{ background:'rgba(0,0,0,0.35)', borderRadius:12, padding:14, marginBottom:14, border:'1px solid rgba(251,191,36,0.25)' }}>
          <div style={{ color:'#FBBF24', fontSize:10, fontWeight:800, letterSpacing:1.5, marginBottom:8 }}>RUN STATISTICS</div>
          {([
            ['Total Rounds', String(totalRounds)],
            ['Max Combo', `×${maxCombo}`],
            ['Final HP', `${finalState.player.hp}/${finalState.player.maxHp}`],
            ['Perks Collected', String(ascent.perks.length)],
            ['Stages Cleared', '3/3'],
          ] as [string, string][]).map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:5, fontSize:12 }}>
              <span style={{ color:'rgba(255,255,255,0.5)' }}>{l}</span>
              <span style={{ color:'white', fontWeight:700 }}>{v}</span>
            </div>
          ))}
        </div>
        {ascent.perks.length > 0 && (
          <div style={{ marginBottom:18 }}>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:9, fontWeight:700, letterSpacing:1.5, marginBottom:6 }}>PERKS EARNED</div>
            <PerkBadges perks={ascent.perks} />
          </div>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <button onClick={onNewRun} style={{
            width:'100%', padding:'12px 0',
            background:'linear-gradient(135deg,#F472B6,#EC4899,#8B5CF6)',
            border:'none', borderRadius:10, color:'white', fontWeight:800, fontSize:13,
            cursor:'pointer', letterSpacing:0.8,
            boxShadow:'0 6px 20px rgba(236,72,153,0.5)',
          }}>🏔️ NEW ASCENT</button>
          <button onClick={onMainMenu} style={{
            width:'100%', padding:'12px 0',
            background:'transparent', border:'1px solid rgba(99,102,241,0.4)',
            borderRadius:10, color:'#818CF8', fontWeight:700, fontSize:13,
            cursor:'pointer', letterSpacing:0.5,
          }}>← MAIN MENU</button>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN ====================

const EFF_GLYPH: Record<string, { glyph: string; color: string; label: string }> = {
  super:  { glyph: '✦', color: '#4ADE80', label: 'Super effective' },
  normal: { glyph: '•', color: '#94A3B8', label: 'Normal' },
  weak:   { glyph: '·', color: '#F87171', label: 'Not very effective' },
};

function FieldNotesPanel({ onClose }: { onClose: () => void }) {
  const notes = getFieldNotes();
  const total = Object.keys(EMOTIONS).length * Object.keys(RESP).length;
  const found = discoveredCount();
  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, zIndex:200,
        background:'rgba(2,6,23,0.82)', backdropFilter:'blur(6px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:'100%', maxWidth:560, maxHeight:'88vh', overflowY:'auto',
          background:'linear-gradient(180deg, rgba(30,41,59,0.97), rgba(15,23,42,0.99))',
          border:'1px solid rgba(255,255,255,0.1)', borderRadius:18,
          boxShadow:'0 30px 80px rgba(0,0,0,0.7)', padding:'18px 18px 22px',
        }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
          <div>
            <div style={{ color:'white', fontSize:18, fontWeight:800 }}>📓 Field Notes</div>
            <div style={{ color:'rgba(255,255,255,0.5)', fontSize:12, marginTop:2 }}>
              What you've learned about reading people. {found} / {total} discovered.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)',
              color:'white', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontSize:13,
            }}
          >Close</button>
        </div>

        <div style={{ display:'flex', gap:12, flexWrap:'wrap', margin:'10px 0 14px' }}>
          {Object.entries(EFF_GLYPH).map(([k, e]) => (
            <span key={k} style={{ color:'rgba(255,255,255,0.6)', fontSize:11, display:'inline-flex', alignItems:'center', gap:4 }}>
              <span style={{ color:e.color, fontWeight:800 }}>{e.glyph}</span> {e.label}
            </span>
          ))}
          <span style={{ color:'rgba(255,255,255,0.4)', fontSize:11, display:'inline-flex', alignItems:'center', gap:4 }}>
            <span style={{ fontWeight:800 }}>?</span> not yet learned
          </span>
        </div>

        <div style={{ overflowX:'auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:`minmax(120px,1.3fr) repeat(${Object.keys(RESP).length}, 1fr)`, gap:4, minWidth:380 }}>
            <div />
            {Object.entries(RESP).map(([id, r]) => (
              <div key={id} title={r.label} style={{ textAlign:'center', fontSize:16 }}>{r.icon}</div>
            ))}
            {Object.entries(EMOTIONS).map(([emoId, emo]: [string, { name: string; icon: string; color: string; aura: string }]) => (
              <Fragment key={emoId}>
                <div style={{ display:'flex', alignItems:'center', gap:6, color:emo.color, fontSize:12, fontWeight:600 }}>
                  <span style={{ fontSize:15 }}>{emo.icon}</span> {emo.name}
                </div>
                {Object.keys(RESP).map(typeId => {
                  const eff = notes[`${emoId}:${typeId}`];
                  const g = eff ? EFF_GLYPH[eff] : null;
                  return (
                    <div key={typeId} style={{
                      display:'flex', alignItems:'center', justifyContent:'center',
                      background: g ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                      border:'1px solid rgba(255,255,255,0.05)', borderRadius:6,
                      minHeight:30, fontSize:16, fontWeight:800,
                      color: g ? g.color : 'rgba(255,255,255,0.22)',
                    }}>
                      {g ? g.glyph : '?'}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SocialCombatRPG({ onExit = null }: { onExit?: (() => void) | null }) {
  const [screen, setScreen] = useState<'select'|'mode'|'tutorial'|'game'|'perk'|'runVictory'>('select');
  const [char, setChar] = useState<CharDef | null>(null);
  const [gs, setGs] = useState<GameState | null>(null);
  const [ascent, setAscent] = useState<AscentRun | null>(null);
  const [perkOptions, setPerkOptions] = useState<PerkOption[] | null>(null);
  const [stageCleared, setStageCleared] = useState<{ stage: number; isBoss: boolean } | null>(null);
  const [tut, setTut] = useState<TutorialState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);
  const [shake, triggerShake] = useShake();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [damageNums, setDamageNums] = useState<DamageNumber[]>([]);
  const [hpFlash, setHpFlash] = useState<{ plr: boolean; opp: boolean }>({ plr: false, opp: false });
  const [ultFlash, setUltFlash] = useState(false);
  const [memory, setMemory] = useState<CombatMemory | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [noteToast, setNoteToast] = useState<string | null>(null);
  const savedRunRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load cross-run memory for the current opponent on scenario entry.
  useEffect(() => {
    const oppId = gs?.opponent?.id;
    if (!oppId || gs?.phase !== 'intro') return;
    let cancelled = false;
    getMemory(oppId).then(m => { if (!cancelled) setMemory(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, [gs?.opponent?.id, gs?.phase]);

  // Persist run on game over.
  useEffect(() => {
    if (!gs || gs.phase !== 'gameover') return;
    if (savedRunRef.current) return;
    if (tut) return; // Don't persist tutorial runs.
    savedRunRef.current = true;

    const conflictId = gs.scenario?.conflictId || (gs.scenario?.id ? parseConflictId(gs.scenario.id) : null);
    const summary = summarizeObjectives(gs);
    const ending = conflictId ? pickEnding(conflictId, summary) : null;
    const mode = ascent ? 'ascent' : 'single';
    const outcome = (ending?.id || (gs.isVictory ? 'win' : 'loss')) as CombatOutcome;
    const score = Math.max(0, (gs.isVictory ? 100 : 0) + gs.maxCombo * 10 + Math.max(0, gs.player.hp));

    recordRun({
      mode,
      scenarioId: gs.scenario?.id ?? null,
      outcome,
      turns: gs.round - 1,
      maxCombo: gs.maxCombo,
      score,
      notes: { counts: gs.counts, finalEmotion: gs.opponent.emotion, character: gs.player.id },
    }).catch(() => {});

    const oppId = gs.opponent?.id;
    if (oppId) {
      const rapportDelta = gs.isVictory
        ? (['grateful', 'trusting', 'vulnerable', 'guilty'].includes(gs.opponent.emotion) ? 2 : 1)
        : -1;
      updateMemory(oppId, {
        rapportDelta,
        facedDelta: 1,
        defeatedDelta: gs.isVictory ? 1 : 0,
        endingSeen: ending?.id,
      }).catch(() => {});
    }
  }, [gs?.phase]);

  // Reset run-save flag when a new scenario starts.
  useEffect(() => {
    if (gs?.phase === 'intro' || gs?.phase === 'playing') {
      savedRunRef.current = false;
    }
  }, [gs?.scenario?.id, gs?.phase]);

  const selectChar = (id: string) => { setChar(CHARS[id as CharKey]); setScreen('mode'); };

  const startSingle = () => {
    if (!char) return;
    setAscent(null); setTut(null);
    setGs(initState(char, null, { perks: [] }));
    setScreen('game');
  };

  const startAscent = () => {
    if (!char) return;
    setTut(null);
    const run = genAscentRun();
    const firstStage = run.stages[0];
    const scenario: Scenario = {
      id: firstStage.id,
      conflictId: firstStage.conflictId,
      opponent: firstStage.opponent,
      setup: firstStage.setup,
      startingEmotion: firstStage.startingEmotion,
    };
    setAscent({ stages: run.stages, stage: 1, perks: [], totalRounds: 0, maxCombo: 0 });
    setGs(initState(char, scenario, { perks: [] }));
    setScreen('game');
  };

  const startTutorial = () => {
    if (!char) return;
    setAscent(null);
    const scenario: Scenario = {
      id:'tutorial',
      conflictId: 'tutorial',
      opponent: { ...TUTORIAL_OPPONENT, stageHp: 999 },
      setup: "Training session with Coach Riley.",
      startingEmotion: TUTORIAL_OPPONENT.startingEmotion as EmotionKey,
    };
    const s = initState(char, scenario, { perks: [] });
    s.opponent.hp = 999; s.opponent.maxHp = 999;
    s.player.maxHp = 200; s.player.hp = 200;
    s.phase = 'playing';
    const first = TUTORIAL_STEPS[0];
    if (first.setup?.emotion) s.opponent.emotion = first.setup.emotion;
    if (first.setup?.charge !== undefined) s.player.charge = first.setup.charge;
    setGs(s);
    setTut({ step: 0, phase: 'before' });
    setParticles([]); setDamageNums([]);
    setScreen('tutorial');
  };

  const coachContinue = () => {
    if (!tut) return;
    if (tut.phase === 'before') {
      setTut({ ...tut, phase: 'action' });
    } else if (tut.phase === 'after') {
      const curStep = TUTORIAL_STEPS[tut.step];
      if (curStep.after?.isFinal) {
        setTut(null); setGs(null); setScreen('mode'); return;
      }
      const nextIdx = tut.step + 1;
      if (nextIdx >= TUTORIAL_STEPS.length) {
        setTut(null); setGs(null); setScreen('mode'); return;
      }
      const next = TUTORIAL_STEPS[nextIdx];
      setGs(g => {
        if (!g) return g;
        const ng = { ...g };
        ng.opponent = { ...ng.opponent, hp: 999 };
        ng.player = { ...ng.player, hp: ng.player.maxHp };
        if (next.setup?.emotion) ng.opponent.emotion = next.setup.emotion;
        if (next.setup?.charge !== undefined) ng.player.charge = next.setup.charge;
        ng.combo = 0;
        return ng;
      });
      setTut({ step: nextIdx, phase: 'before' });
    }
  };

  const exitTutorial = () => {
    setTut(null); setGs(null); setScreen('mode');
  };

  const openPerkSelect = () => {
    if (!ascent) return;
    const excluded = ascent.perks;
    const opts = pickPerks(excluded);
    setPerkOptions(opts);
    setScreen('perk');
  };

  const pickPerk = (perkId: PerkId) => {
    if (!ascent || !gs || !char) return;
    const newPerks = [...ascent.perks, perkId];
    const nextStageNum = ascent.stage + 1;
    const nextStage = ascent.stages[nextStageNum - 1];
    const scenario: Scenario = {
      id: nextStage.id,
      conflictId: nextStage.conflictId,
      opponent: nextStage.opponent,
      setup: nextStage.setup,
      startingEmotion: nextStage.startingEmotion,
    };
    const carryHp = gs.player.hp;
    const newAscent: AscentRun = {
      ...ascent,
      stage: nextStageNum,
      perks: newPerks,
      totalRounds: ascent.totalRounds + (gs.round - 1),
      maxCombo: Math.max(ascent.maxCombo, gs.maxCombo),
    };
    setAscent(newAscent);
    setGs(initState(char, scenario, { perks: newPerks, carryHp }));
    setPerkOptions(null);
    setParticles([]); setDamageNums([]);
    setScreen('game');
  };

  const retryStage = () => {
    if (!ascent || !char) return;
    const stage = ascent.stages[ascent.stage - 1];
    const scenario: Scenario = {
      id: stage.id,
      conflictId: stage.conflictId,
      opponent: stage.opponent,
      setup: stage.setup,
      startingEmotion: stage.startingEmotion,
    };
    setGs(initState(char, scenario, { perks: ascent.perks }));
    setParticles([]); setDamageNums([]);
  };

  const abandonRun = () => {
    setAscent(null);
    setGs(null);
    setScreen('mode');
  };

  const spawnParticles = (color: string, count: number, fromOpp = true, isUltimate = false) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const baseX = fromOpp ? rect.width * 0.78 : rect.width * 0.22;
    const baseY = 130;
    const newParts = Array.from({ length: count }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const velocity = isUltimate ? 60 + Math.random() * 80 : 30 + Math.random() * 50;
      return {
        id: uid(),
        x: baseX + (Math.random() - 0.5) * 30,
        y: baseY + (Math.random() - 0.5) * 30,
        dx: Math.cos(angle) * velocity,
        dy: Math.sin(angle) * velocity - 20,
        size: 3 + Math.random() * (isUltimate ? 6 : 4),
        color,
        duration: 700 + Math.random() * 500,
      };
    });
    setParticles(p => [...p, ...newParts]);
    const maxDur = Math.max(...newParts.map(p => p.duration));
    setTimeout(() => setParticles(p => p.filter(pt => !newParts.some(np => np.id === pt.id))), maxDur + 100);
  };

  const spawnDamage = (value: number, target: 'opp' | 'plr', eff: EffType, isCrit = false, isUlt = false) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = target === 'opp' ? rect.width * 0.78 : rect.width * 0.22;
    const y = 110 + (Math.random() - 0.5) * 20;
    const id = uid();
    setDamageNums(d => [...d, { id, x, y, value, eff, isCrit, isUlt }]);
    setTimeout(() => setDamageNums(d => d.filter(n => n.id !== id)), 1500);
  };

  const handleResp = (type: RespType | 'ultimate', isUltimate = false) => {
    if (busy || !gs) return;
    setBusy(true);
    const prevEmo = gs.opponent.emotion;
    const actualType: RespType = isUltimate ? 'aggression' : type as RespType;
    const { next, events } = processResp(gs, actualType, isUltimate);

    // Field Notes: record what this response did against the emotion it was
    // used on, so the player's hidden knowledge becomes a visible, growing codex.
    if (!isUltimate && type !== 'ultimate') {
      const eff = getEff(type, prevEmo) as Eff;
      const isNewNote = recordFieldNote(prevEmo, type, eff);
      if (isNewNote && !tut) {
        const emoName = EMOTIONS[prevEmo]?.name || prevEmo;
        const effName = eff === 'super' ? 'super effective' : eff === 'weak' ? 'not very effective' : 'a normal hit';
        setNoteToast(`📓 New field note: ${RESP[type].label} is ${effName} on ${emoName}`);
        setTimeout(() => setNoteToast(n => (n && n.startsWith('📓') ? null : n)), 2600);
      }
    }

    // Tutorial safeguard: keep HP full so the fight can't end
    if (tut) {
      next.opponent.hp = 999;
      next.opponent.maxHp = 999;
      next.player.hp = Math.min(gs.player.hp, next.player.maxHp);
      next.phase = 'playing';
      next.isVictory = false;
    }

    events.forEach(e => {
      if (e.kind === 'shake') triggerShake(e.intensity);
      if (e.kind === 'particles') spawnParticles(e.color || '#fff', e.count || 0, true, e.burst === 'ultimate');
      if (e.kind === 'damage') {
        spawnDamage(e.value || 0, e.target || 'opp', e.eff || 'normal', e.isCrit, e.isUlt);
        if (e.eff !== 'heal' && e.target === 'plr') {
          setHpFlash(f => ({ ...f, plr: true }));
          setTimeout(() => setHpFlash(f => ({ ...f, plr: false })), 500);
        }
        if (e.target === 'opp') {
          setHpFlash(f => ({ ...f, opp: true }));
          setTimeout(() => setHpFlash(f => ({ ...f, opp: false })), 500);
        }
      }
    });

    if (isUltimate) {
      setUltFlash(true);
      setTimeout(() => setUltFlash(false), 700);
    }

    setGs(next);

    if (prevEmo !== next.opponent.emotion) {
      const e = EMOTIONS[next.opponent.emotion];
      setNotif(`${next.opponent.name} is now ${e?.name || next.opponent.emotion}`);
      setTimeout(() => setNotif(null), 2200);
    }

    // Tutorial: advance phase to 'after' once animations complete
    if (tut && tut.phase === 'action') {
      setTimeout(() => {
        setTut(t => t ? { ...t, phase: 'after' } : null);
        setBusy(false);
      }, isUltimate ? 1600 : 1200);
      return;
    }

    if (next.phase === 'gameover' && next.isVictory && ascent) {
      const isLastStage = ascent.stage === 3;
      setTimeout(() => {
        setStageCleared({ stage: ascent.stage, isBoss: isLastStage });
        setTimeout(() => {
          setStageCleared(null);
          if (isLastStage) setScreen('runVictory');
          else openPerkSelect();
        }, 1800);
      }, 1200);
    }

    setTimeout(() => setBusy(false), isUltimate ? 1000 : 700);
  };

  const appBg: CSSProperties = {
    minHeight:'100vh',
    background:'linear-gradient(180deg,#020617,#0F172A,#0F172A)',
    display:'flex', alignItems:'center', justifyContent:'center', padding:16,
    position:'relative', overflow:'hidden',
  };

  if (screen === 'select') return (
    <div style={appBg}>
      <Starfield />
      <CharSelect onSelect={selectChar} onExit={onExit} />
      <button
        onClick={() => setShowNotes(true)}
        style={{
          position:'absolute', top:16, right:16, zIndex:30,
          background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.14)',
          color:'white', borderRadius:10, padding:'6px 12px', cursor:'pointer',
          fontSize:13, fontWeight:600, backdropFilter:'blur(4px)',
        }}
      >📓 Field Notes</button>
      {showNotes && <FieldNotesPanel onClose={() => setShowNotes(false)} />}
    </div>
  );

  if (screen === 'mode') return (
    <div style={appBg}>
      <Starfield />
      <ModeSelect
        char={char!}
        onTutorial={startTutorial}
        onSingle={startSingle}
        onAscent={startAscent}
        onBack={() => { setChar(null); setScreen('select'); }}
      />
    </div>
  );

  if (screen === 'perk' && perkOptions && ascent) {
    const nextStageNum = ascent.stage + 1;
    const isNextBoss = ascent.stages[nextStageNum - 1]?.isBoss;
    return (
      <div style={appBg}>
        <Starfield />
        <div style={{ width:'100%', maxWidth:700, zIndex:1 }}>
          <PerkSelect
            options={perkOptions}
            stage={ascent.stage}
            nextStage={nextStageNum}
            isBoss={isNextBoss}
            currentPerks={ascent.perks}
            onPick={pickPerk}
          />
        </div>
      </div>
    );
  }

  if (screen === 'runVictory' && ascent && gs) return (
    <div style={appBg}>
      <Starfield />
      <div ref={containerRef} style={{
        width:'100%', maxWidth:680,
        background:'linear-gradient(180deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))',
        border:'1px solid rgba(255,255,255,0.07)',
        borderRadius:20, overflow:'hidden',
        boxShadow:'0 30px 80px rgba(0,0,0,0.7)',
        position:'relative', backdropFilter:'blur(12px)', zIndex:1,
        minHeight: 400,
      }}>
        <RunVictory
          ascent={ascent}
          finalState={gs}
          onNewRun={() => { setAscent(null); setGs(null); setPerkOptions(null); startAscent(); }}
          onMainMenu={() => { setAscent(null); setGs(null); setPerkOptions(null); onExit ? onExit() : (setChar(null), setScreen('select')); }}
        />
      </div>
    </div>
  );

  if (!gs) return null;

  // ========== Tutorial screen ==========
  if (screen === 'tutorial' && tut) {
    const curStep = TUTORIAL_STEPS[tut.step];
    const ult = ULTIMATES[gs.player.ultimate];
    const allowedResponses = tut.phase === 'action' && curStep.forceResponse !== 'ultimate'
      ? [curStep.forceResponse].filter(r => gs.player.responses.includes(r as RespType))
      : [];
    const canUseUlt = tut.phase === 'action' && curStep.forceResponse === 'ultimate';
    const displayCharge = canUseUlt ? gs.player.charge : Math.min(gs.player.charge, 99);

    return (
      <div style={appBg}>
        <Starfield />
        <div ref={containerRef} style={{
          width:'100%', maxWidth:680,
          background:'linear-gradient(180deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))',
          border:'1px solid rgba(251,191,36,0.25)',
          borderRadius:20, overflow:'hidden',
          boxShadow:'0 30px 80px rgba(0,0,0,0.7), 0 0 100px rgba(251,191,36,0.1)',
          position:'relative', backdropFilter:'blur(12px)', zIndex:1,
          // @ts-ignore
          '--sx': `${(Math.random() - 0.5) * shake * 2}px`,
          '--sy': `${(Math.random() - 0.5) * shake * 1.5}px`,
          animation: shake > 0 ? 'shakeX 0.4s' : undefined,
        }}>
          <div style={{
            padding:'8px 14px',
            display:'flex', justifyContent:'space-between', alignItems:'center',
            background:'linear-gradient(90deg, rgba(251,191,36,0.1), rgba(251,191,36,0.04))',
            borderBottom:'1px solid rgba(251,191,36,0.2)',
          }}>
            <div style={{ color:'#FBBF24', fontSize:10, fontWeight:800, letterSpacing:1.5 }}>
              🏀 TUTORIAL · LESSON {tut.step + 1} / {TUTORIAL_STEPS.length}
            </div>
            <button onClick={exitTutorial} style={{
              background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
              borderRadius:6, padding:'3px 10px', color:'rgba(255,255,255,0.6)',
              fontSize:10, cursor:'pointer', fontWeight:600,
            }}>Exit Tutorial</button>
          </div>

          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'18px 20px 14px',
            background:'linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.1))',
            borderBottom:'1px solid rgba(255,255,255,0.05)',
            position:'relative',
          }}>
            <Avatar char={gs.player} isOpp={false} damaged={hpFlash.plr} />
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:24, marginBottom:4, filter:'drop-shadow(0 0 12px rgba(251,191,36,0.5))' }}>🎯</div>
              <div style={{ color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase' }}>train</div>
            </div>
            <Avatar char={gs.opponent} isOpp={true} damaged={hpFlash.opp} />
          </div>

          <DlgLog entries={gs.dialogue} round={gs.round} combo={gs.combo} />

          {tut.phase === 'action' && curStep.instruct && (
            <InstructionBanner text={curStep.instruct} />
          )}

          <RespBar
            responses={allowedResponses}
            onResp={(type: RespType) => handleResp(type)}
            onUltimate={() => handleResp('ultimate', true)}
            opponent={gs.opponent}
            disabled={tut.phase !== 'action' || busy}
            charge={displayCharge}
            ult={ult}
            playerId={gs.player.id}
            scenarioId={gs.scenario.id}
          />

          <Particles particles={particles} />
          <FloatingDamage numbers={damageNums} />

          {ultFlash && (
            <div style={{
              position:'absolute', inset:0,
              background:`radial-gradient(circle at center, ${ult.color}44, transparent 70%)`,
              animation:'ultimateFlash 0.7s ease-out forwards',
              pointerEvents:'none', zIndex:25,
            }} />
          )}

          {(tut.phase === 'before' || tut.phase === 'after') && (
            <TutorialCoach
              step={tut.step + 1}
              total={TUTORIAL_STEPS.length}
              content={tut.phase === 'before' ? curStep.before : curStep.after}
              onContinue={coachContinue}
            />
          )}

          {notif && (
            <div style={{
              position:'absolute', top:'42%', left:'50%', transform:'translate(-50%,-50%)',
              background:'rgba(0,0,0,0.92)', border:'1px solid rgba(255,255,255,0.2)',
              borderRadius:12, padding:'10px 22px', color:'white', fontWeight:700,
              zIndex:100, fontSize:13, pointerEvents:'none',
              backdropFilter:'blur(8px)',
              boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
              animation: 'slideIn 0.3s ease-out',
            }}>
              {notif}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== Regular game screen ==========
  const newChallenge = () => { if (char) { setGs(initState(char, null, { perks: [] })); setParticles([]); setDamageNums([]); } };
  const restart = () => { if (char && gs) { setGs(initState(char, gs.scenario, { perks: gs.player.perks })); setParticles([]); setDamageNums([]); } };
  const newGame = () => { setScreen('select'); setChar(null); setGs(null); setAscent(null); setPerkOptions(null); setTut(null); setParticles([]); setDamageNums([]); };
  const exitGame = () => {
    if (gs.phase === 'playing' && !window.confirm('Leave this conversation? Your progress in this fight will be lost.')) return;
    if (onExit) onExit(); else newGame();
  };
  const ult = ULTIMATES[gs.player.ultimate];
  const currentStage = ascent?.stages[ascent.stage - 1];
  const isBossFight = currentStage?.isBoss;

  return (
    <div style={appBg}>
      <Starfield />
      <div
        ref={containerRef}
        style={{
          width:'100%', maxWidth:680,
          background:'linear-gradient(180deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))',
          border: `1px solid ${isBossFight && gs.phase === 'playing' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius:20, overflow:'hidden',
          boxShadow: isBossFight && gs.phase === 'playing'
            ? '0 30px 80px rgba(0,0,0,0.7), 0 0 120px rgba(239,68,68,0.2)'
            : '0 30px 80px rgba(0,0,0,0.7), 0 0 120px rgba(99,102,241,0.1)',
          position:'relative',
          backdropFilter:'blur(12px)',
          // @ts-ignore
          '--sx': `${(Math.random() - 0.5) * shake * 2}px`,
          '--sy': `${(Math.random() - 0.5) * shake * 1.5}px`,
          animation: shake > 0 ? 'shakeX 0.4s' : undefined,
          zIndex:1,
        }}
      >
        {(gs.phase === 'intro' || gs.phase === 'playing') && (
          <button
            onClick={exitGame}
            title="Leave the conversation"
            style={{
              position:'absolute', top:8, left:10, zIndex:40,
              background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.14)',
              color:'rgba(255,255,255,0.85)', borderRadius:8, padding:'4px 10px',
              cursor:'pointer', fontSize:12, fontWeight:600, lineHeight:1,
              display:'flex', alignItems:'center', gap:5, backdropFilter:'blur(4px)',
            }}
          >← Exit</button>
        )}
        {ascent && (
          <div style={{
            padding:'8px 12px',
            background:'rgba(0,0,0,0.3)',
            borderBottom:'1px solid rgba(255,255,255,0.05)',
          }}>
            <StageIndicator currentStage={ascent.stage} stages={ascent.stages} />
            {ascent.perks.length > 0 && (
              <div style={{ marginTop:4 }}>
                <PerkBadges perks={ascent.perks} compact />
              </div>
            )}
          </div>
        )}

        {gs.phase === 'intro' && (
          <ScenarioIntro scenario={gs.scenario} onStart={() => setGs(s => s ? ({...s, phase:'playing'}) : s)} isBoss={isBossFight} memory={memory} />
        )}

        {gs.phase === 'playing' && (
          <>
            <div style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'18px 20px 14px',
              background:'linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.1))',
              borderBottom:'1px solid rgba(255,255,255,0.05)',
              position:'relative',
            }}>
              <Avatar char={gs.player} isOpp={false} damaged={hpFlash.plr} />
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:24, marginBottom:4, filter:'drop-shadow(0 0 12px rgba(139,92,246,0.5))' }}>⚔️</div>
                <div style={{ color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase' }}>vs</div>
              </div>
              <Avatar char={gs.opponent} isOpp={true} damaged={hpFlash.opp} />
              <button
                onClick={() => setShowNotes(true)}
                title="Field Notes — what you've learned"
                style={{
                  position:'absolute', top:8, right:10, zIndex:30,
                  background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.14)',
                  color:'white', borderRadius:8, padding:'3px 8px', cursor:'pointer', fontSize:13,
                  lineHeight:1, backdropFilter:'blur(4px)',
                }}
              >📓</button>
            </div>
            <DlgLog entries={gs.dialogue} round={gs.round} combo={gs.combo} />
            <RespBar
              responses={gs.player.responses}
              onResp={(type: RespType) => handleResp(type)}
              onUltimate={() => handleResp('ultimate', true)}
              opponent={gs.opponent}
              disabled={busy}
              charge={gs.player.charge}
              ult={ult}
              playerId={gs.player.id}
              scenarioId={gs.scenario.id}
            />
          </>
        )}

        {gs.phase === 'gameover' && !stageCleared && !(ascent && gs.isVictory) && (
          <>
            <div style={{ padding:'18px 20px 0', background:'rgba(0,0,0,0.2)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <Avatar char={gs.player} isOpp={false} />
                <div style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:600 }}>Round {gs.round - 1}</div>
                <Avatar char={gs.opponent} isOpp={true} />
              </div>
            </div>
            <GameOver
              state={gs}
              ascent={ascent}
              onRestart={restart}
              onNewChallenge={newChallenge}
              onNewGame={newGame}
              onRetryStage={retryStage}
              onAbandonRun={abandonRun}
            />
          </>
        )}

        {gs.phase === 'gameover' && ascent && gs.isVictory && (
          <div style={{ padding:'18px 20px 0', background:'rgba(0,0,0,0.2)', minHeight: 200 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <Avatar char={gs.player} isOpp={false} />
              <div style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:600 }}>Round {gs.round - 1}</div>
              <Avatar char={gs.opponent} isOpp={true} />
            </div>
          </div>
        )}

        <Particles particles={particles} />
        <FloatingDamage numbers={damageNums} />

        {ultFlash && (
          <div style={{
            position:'absolute', inset:0,
            background:`radial-gradient(circle at center, ${ult.color}44, transparent 70%)`,
            animation:'ultimateFlash 0.7s ease-out forwards',
            pointerEvents:'none', zIndex:25,
          }} />
        )}

        {stageCleared && <StageClear stage={stageCleared.stage} isBoss={stageCleared.isBoss} />}

        {notif && (
          <div style={{
            position:'absolute', top:'42%', left:'50%', transform:'translate(-50%,-50%)',
            background:'rgba(0,0,0,0.92)', border:'1px solid rgba(255,255,255,0.2)',
            borderRadius:12, padding:'10px 22px', color:'white', fontWeight:700,
            zIndex:100, fontSize:13, pointerEvents:'none',
            backdropFilter:'blur(8px)',
            boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
            animation: 'slideIn 0.3s ease-out',
          }}>
            {notif}
          </div>
        )}

        {noteToast && (
          <div style={{
            position:'absolute', left:'50%', bottom:14, transform:'translateX(-50%)',
            background:'rgba(8,15,40,0.95)', border:'1px solid rgba(74,222,128,0.4)',
            borderRadius:12, padding:'9px 16px', color:'#D1FAE5', fontWeight:600,
            zIndex:120, fontSize:12.5, maxWidth:'90%', textAlign:'center',
            pointerEvents:'none', backdropFilter:'blur(8px)',
            boxShadow:'0 8px 32px rgba(0,0,0,0.6)', animation:'slideIn 0.3s ease-out',
          }}>
            {noteToast}
          </div>
        )}
      </div>

      {showNotes && <FieldNotesPanel onClose={() => setShowNotes(false)} />}
    </div>
  );
}
