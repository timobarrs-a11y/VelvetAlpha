import type { InsightCard, ReflectionAtom } from "../types";
import { calculateConfidence } from "../confidence";
import { detectThoughtPattern } from "../thoughtPatterns";

function uid(): string {
  return (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

const PATTERN_LABELS: Record<string, { label: string; description: string; experiment: string }> = {
  all_or_nothing: {
    label: "all-or-nothing thinking",
    description: "Words like 'always' and 'never' are signals of black-and-white framing. This style of thinking tends to collapse nuance into extremes, making situations feel more permanent and fixed than they are.",
    experiment: "Take one 'always/never' statement you've written and rewrite it as a 'sometimes' or 'in certain situations' statement. Notice what changes in how it feels.",
  },
  mind_reading: {
    label: "mind-reading",
    description: "Assuming you know what others are thinking — usually negatively — is a form of filling in blanks with worst-case interpretations. The mind reads in stories faster than facts arrive.",
    experiment: "For one assumption about what someone thinks, write down two alternative explanations that are equally plausible but more neutral.",
  },
  worst_case_jump: {
    label: "catastrophizing",
    description: "Jumping to worst-case outcomes amplifies uncertainty into felt danger. The imagination often runs ahead of evidence.",
    experiment: "Ask: What's the realistic outcome? What's happened in similar situations before? Write a 'most likely' scenario alongside the catastrophic one.",
  },
  self_blame: {
    label: "self-blame",
    description: "Taking responsibility for things outside your control is exhausting and often inaccurate. It's worth asking which parts you actually owned and which parts you inherited.",
    experiment: "List what was in your control vs. what wasn't. For each 'I ruined' or 'my fault,' check: could anyone else have contributed?",
  },
  future_assuming: {
    label: "future-predicting",
    description: "Treating future failures as certain is a confidence-eroding pattern. The mind mistakes its predictions for facts.",
    experiment: "Write down the prediction, then rate your actual track record on similar predictions. How often did the feared outcome actually happen?",
  },
};

export function generateThoughtIntensityInsight(atoms: ReflectionAtom[]): InsightCard | null {
  const thoughtAtoms = atoms.filter(a => a.automaticThought?.trim());
  if (thoughtAtoms.length < 2) return null;

  const patternCounts: Record<string, number> = {};
  for (const a of thoughtAtoms) {
    const pattern = detectThoughtPattern(a.automaticThought);
    if (pattern) {
      patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
    }
  }

  const top = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;

  const [patternKey, count] = top;
  const meta = PATTERN_LABELS[patternKey];
  if (!meta) return null;

  return {
    id: uid(),
    templateId: "thought_intensity_pattern",
    title: `A pattern of ${meta.label}`,
    observation: `Your automatic thoughts show signs of ${meta.label} in ${count} of the moments you've logged.`,
    pattern: meta.description,
    whyItMakesSense: "Cognitive distortions aren't flaws — they're shortcuts the brain developed to process uncertainty quickly. They become problems when they run unchecked.",
    experiment: meta.experiment,
    confidence: calculateConfidence(count),
  };
}
