import type { InsightCard, ReflectionAtom } from "../types";
import { generateEmotionFrequencyInsight } from "./emotionFrequency";
import { generateAvoidanceInsight } from "./avoidance";
import { generateBehaviorLoopInsight } from "./behaviorLoop";
import { generateThoughtIntensityInsight } from "./thoughtIntensity";
import { generateCoreNeedInsight } from "./coreNeed";
import { generateSelfTalkInsight } from "./selfTalk";

export function runDeterministicGenerators(atoms: ReflectionAtom[]): InsightCard[] {
  const out: InsightCard[] = [];

  const a = generateEmotionFrequencyInsight(atoms);
  if (a) out.push(a);

  const b = generateAvoidanceInsight(atoms);
  if (b) out.push(b);

  const c = generateBehaviorLoopInsight(atoms);
  if (c) out.push(c);

  const d = generateThoughtIntensityInsight(atoms);
  if (d) out.push(d);

  const e = generateCoreNeedInsight(atoms);
  if (e) out.push(e);

  const f = generateSelfTalkInsight(atoms);
  if (f) out.push(f);

  return out;
}
