import type { InsightCard, ReflectionAtom } from "../types";
import { calculateConfidence } from "../confidence";

function uid(): string {
  return (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function generateEmotionFrequencyInsight(atoms: ReflectionAtom[]): InsightCard | null {
  const emotionData: Record<string, { count: number; totalIntensity: number }> = {};

  for (const a of atoms) {
    const e = a.emotion?.trim();
    if (!e) continue;
    if (!emotionData[e]) emotionData[e] = { count: 0, totalIntensity: 0 };
    emotionData[e].count += 1;
    emotionData[e].totalIntensity += a.emotionIntensity ?? 5;
  }

  const top = Object.entries(emotionData).sort((a, b) => {
    const scoreA = a[1].count * (a[1].totalIntensity / a[1].count);
    const scoreB = b[1].count * (b[1].totalIntensity / b[1].count);
    return scoreB - scoreA;
  })[0];

  if (!top) return null;

  const [topEmotion, { count, totalIntensity }] = top;
  const avgIntensity = Math.round(totalIntensity / count);
  const intensityNote = avgIntensity >= 7 ? `, often at high intensity (${avgIntensity}/10)` : avgIntensity <= 3 ? `, usually at low intensity (${avgIntensity}/10)` : '';

  return {
    id: uid(),
    templateId: "emotion_frequency_pattern",
    title: "A recurring emotional theme",
    observation: `You've mentioned feeling ${topEmotion} ${count} time${count === 1 ? "" : "s"} recently${intensityNote}.`,
    pattern: `This emotion shows up more than others and carries notable weight in your reflections.`,
    whyItMakesSense: `It may be connected to situations that matter to you — things that feel meaningful enough to register at a felt level.`,
    experiment: `Next time it appears, pause and ask what it's trying to signal before reacting.`,
    confidence: calculateConfidence(count),
  };
}
