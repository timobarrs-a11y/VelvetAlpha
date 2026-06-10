import type { InsightCard, ReflectionAtom } from "../types";
import { calculateConfidence } from "../confidence";

function uid(): string {
  return (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function generateAvoidanceInsight(atoms: ReflectionAtom[]): InsightCard | null {
  const behaviors = atoms
    .map(a => a.behavior?.toLowerCase().replace(/\u2019/g, "'").replace(/\u2018/g, "'"))
    .filter(Boolean) as string[];

  const hits = behaviors.filter(b =>
    b.includes("avoid") ||
    b.includes("scroll") ||
    b.includes("put it off") ||
    b.includes("put off") ||
    b.includes("procrast") ||
    b.includes("skip") ||
    b.includes("ignored") ||
    b.includes("ignore") ||
    b.includes("didn't") ||
    b.includes("did not") ||
    b.includes("stayed away") ||
    b.includes("didn't reply")
  );

  if (hits.length < 1) return null;

  return {
    id: uid(),
    templateId: "avoidance_pattern",
    title: "A pattern of stepping back",
    observation: "In some of the moments you've shared, your response was to move away from something rather than toward it.",
    pattern: "Avoidance tends to work short-term — it reduces discomfort immediately. The cost is usually that the original discomfort doesn't actually go away.",
    whyItMakesSense: "Stepping back from hard things is a very human response. It protects you from overwhelm in the moment, and it made sense when it started.",
    experiment: "Pick one thing you've been sidestepping. Make it 20% smaller. Just start with that tiny version and see what happens.",
    confidence: calculateConfidence(hits.length),
  };
}
