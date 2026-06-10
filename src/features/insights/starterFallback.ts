import type { InsightCard } from "./types";

const STARTER_INSIGHTS: InsightCard[] = [
  {
    id: "starter-gentle-start",
    templateId: "starter_fallback",
    title: "A gentle starting point",
    observation: "You haven't shared enough yet for strong patterns — and that's totally normal.",
    pattern: "Insights get sharper after a few quick reflections.",
    whyItMakesSense: "Your brain is complex; it takes a bit of context to mirror you accurately.",
    experiment: "Try one short check-in today: name the moment that shifted your mood, and what you told yourself.",
    confidence: "starter",
  },
  {
    id: "starter-mind-protects",
    templateId: "starter_fallback",
    title: "How your mind protects you",
    observation: "Most people's minds try to reduce uncertainty quickly, especially under pressure.",
    pattern: "When something feels unclear, your brain may fill in the blank fast.",
    whyItMakesSense: "It's a safety move — certainty feels calmer than the unknown.",
    experiment: "Next time uncertainty shows up, write 3 possible explanations before choosing one.",
    confidence: "starter",
  },
  {
    id: "starter-next-unlock",
    templateId: "starter_fallback",
    title: "Your next insight unlock",
    observation: "The fastest way to get personal insights is a simple 60-second reflection.",
    pattern: "A few small entries create enough signal to detect themes.",
    whyItMakesSense: "Patterns emerge from repetition, not perfection.",
    experiment: "Tonight: What happened → what you thought → what you felt (1–10) → what you did next.",
    confidence: "starter",
  },
];

export function getStarterFallbackInsights(): InsightCard[] {
  return STARTER_INSIGHTS;
}
