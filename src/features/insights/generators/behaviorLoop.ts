import type { InsightCard, ReflectionAtom } from "../types";
import { calculateConfidence } from "../confidence";

function uid(): string {
  return (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function normalizeQuotes(text: string): string {
  return text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
}

export function generateBehaviorLoopInsight(atoms: ReflectionAtom[]): InsightCard | null {
  const withBehaviorAndOutcome = atoms.filter(a => a.behavior && a.outcome);
  if (withBehaviorAndOutcome.length < 3) return null;

  const negativeOutcomes = withBehaviorAndOutcome.filter(a => {
    const normalized = normalizeQuotes(a.outcome ?? '');
    return /worse|bad|regret|didn't help|same|stuck/i.test(normalized);
  });

  if (negativeOutcomes.length === 0) {
    return {
      id: uid(),
      templateId: "behavior_loop_pattern",
      title: "Your responses seem to be working",
      observation: "Looking at the moments you've shared, the actions you took tended to lead somewhere useful.",
      pattern: "When behavior and outcome are aligned, that's worth noticing. It means your instincts are calibrated.",
      whyItMakesSense: "Positive loops are just as worth understanding as negative ones — knowing what actually works helps you do it intentionally.",
      experiment: "Think about one of those moments. What exactly did you do that made the difference? Write it down as a rule you could apply again.",
      confidence: calculateConfidence(withBehaviorAndOutcome.length),
    };
  }

  return {
    id: uid(),
    templateId: "behavior_loop_pattern",
    title: "A loop worth looking at",
    observation: "In several of the moments you've shared, the same kind of action seems to lead to the same kind of result.",
    pattern: "Repeated behaviors that don't change outcomes often indicate a loop: the situation triggers a thought, the thought drives the behavior, and the behavior reinforces the original situation.",
    whyItMakesSense: "Getting stuck in a loop isn't a personal failing. Loops persist because the behavior does provide some relief — just not the kind that solves the underlying thing.",
    experiment: "Next time you're in that situation, try one different action — just one. You're not trying to fix everything, just introducing a variable.",
    confidence: calculateConfidence(negativeOutcomes.length),
  };
}
