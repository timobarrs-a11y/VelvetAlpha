import type { InsightCard, ReflectionAtom } from "../types";
import { calculateConfidence } from "../confidence";

function uid(): string {
  return (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

type CoreNeed = "safety" | "validation" | "control" | "connection";

const NEED_SIGNALS: Record<CoreNeed, { emotions: string[]; thoughts: string[]; behaviors: string[] }> = {
  safety: {
    emotions: ["scared", "anxious", "worried", "panicked", "nervous", "fearful", "dread", "uneasy", "tense"],
    thoughts: ["unsafe", "danger", "threat", "can't trust", "going wrong", "not safe", "something bad", "what if"],
    behaviors: ["avoid", "escape", "check", "prepare", "plan", "cancel", "stayed home", "locked", "hid"],
  },
  validation: {
    emotions: ["ashamed", "embarrassed", "insecure", "inadequate", "rejected", "judged", "humiliated", "unworthy"],
    thoughts: ["not good enough", "they think", "failure", "everyone", "nobody cares", "looked stupid", "worthless", "useless", "don't belong"],
    behaviors: ["apologized", "people-pleased", "over-explained", "justified", "sought approval", "asked for feedback", "posted", "shared"],
  },
  control: {
    emotions: ["frustrated", "overwhelmed", "powerless", "helpless", "stuck", "trapped", "angry", "irritated"],
    thoughts: ["can't control", "nothing works", "no choice", "forced", "have to", "must", "should", "unfair", "out of my hands"],
    behaviors: ["tried to fix", "planned", "organized", "managed", "micromanaged", "took over", "insisted", "pushed"],
  },
  connection: {
    emotions: ["lonely", "isolated", "disconnected", "unloved", "invisible", "abandoned", "misunderstood", "left out"],
    thoughts: ["no one understands", "alone", "nobody", "don't care", "pushed away", "different", "excluded", "forgotten"],
    behaviors: ["reached out", "withdrew", "scrolled", "texted", "avoided people", "stayed in", "didn't reply", "waited"],
  },
};

const NEED_META: Record<CoreNeed, { title: string; whyItMakesSense: string; experiment: string }> = {
  safety: {
    title: "A recurring need for safety",
    whyItMakesSense: "When safety feels uncertain, the nervous system stays on alert. This isn't weakness — it's a protection system doing its job, sometimes louder than necessary.",
    experiment: "When anxiety spikes, ask: 'What specifically feels unsafe right now?' Naming the actual threat (vs. the imagined one) often reduces its intensity.",
  },
  validation: {
    title: "A recurring need for validation",
    whyItMakesSense: "Needing to feel seen and valued is one of the most fundamental human drives. It becomes heavy when external approval is the only source.",
    experiment: "Before seeking external validation this week, pause and ask: 'What would I think of this if no one else weighed in?' Write down that answer.",
  },
  control: {
    title: "A recurring need for control",
    whyItMakesSense: "The urge to control is almost always about reducing uncertainty, which makes complete sense. The problem is that the more we grip, the more we feel the resistance.",
    experiment: "Pick one thing you've been trying to control that's actually outside your influence. Write down what you'd do if you simply accepted that outcome.",
  },
  connection: {
    title: "A recurring need for connection",
    whyItMakesSense: "Loneliness and disconnection are among the most universal experiences. Feeling this doesn't mean you're hard to love — often it means you care deeply.",
    experiment: "Think of one person you've been meaning to reach out to. Send one low-stakes message this week. Connection often only needs a small invitation.",
  },
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/\u2019/g, "'").replace(/\u2018/g, "'");
}

function scoreAtomForNeed(atom: ReflectionAtom, need: CoreNeed): number {
  const signals = NEED_SIGNALS[need];
  let score = 0;

  const fields = [
    normalize(atom.emotion ?? ""),
    normalize(atom.automaticThought ?? ""),
    normalize(atom.behavior ?? ""),
    normalize(atom.situation ?? ""),
  ];

  for (const field of fields) {
    for (const keyword of signals.emotions) {
      if (field.includes(keyword)) score++;
    }
    for (const keyword of signals.thoughts) {
      if (field.includes(keyword)) score++;
    }
    for (const keyword of signals.behaviors) {
      if (field.includes(keyword)) score++;
    }
  }

  return score;
}

export function generateCoreNeedInsight(atoms: ReflectionAtom[]): InsightCard | null {
  if (atoms.length < 3) return null;

  const needScores: Record<CoreNeed, number> = {
    safety: 0,
    validation: 0,
    control: 0,
    connection: 0,
  };

  for (const atom of atoms) {
    for (const need of Object.keys(needScores) as CoreNeed[]) {
      needScores[need] += scoreAtomForNeed(atom, need);
    }
  }

  const top = (Object.entries(needScores) as [CoreNeed, number][])
    .sort((a, b) => b[1] - a[1])[0];

  if (!top || top[1] === 0) return null;

  const [need, score] = top;
  const meta = NEED_META[need];

  return {
    id: uid(),
    templateId: "core_need_pattern",
    title: meta.title,
    observation: `Across your reflections, a theme of needing ${need} shows up more than other needs.`,
    pattern: `The situations and emotions you've logged tend to cluster around moments where ${need} felt uncertain or absent. This underlying need often drives the surface-level reactions.`,
    whyItMakesSense: meta.whyItMakesSense,
    experiment: meta.experiment,
    confidence: calculateConfidence(score),
  };
}
