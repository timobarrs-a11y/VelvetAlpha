import type { InsightCard, ReflectionAtom } from "../types";
import { calculateConfidence } from "../confidence";

function uid(): string {
  return (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

const HARSH_PATTERNS = [
  /\bi('m| am) so (stupid|dumb|pathetic|useless|worthless|incompetent|lazy|weak|broken)/i,
  /\bi (hate|despise|can't stand) (myself|me)/i,
  /\bwhat('s| is) wrong with me\b/i,
  /\bi('m| am) such a (failure|loser|mess|disaster|idiot|burden)/i,
  /\bi (ruined|messed up|screwed up|blew it) everything/i,
  /\bi (never|can't|couldn't) (do|get|be|handle)/i,
  /\bi (should have|shouldn't have|could have|shouldn't)/i,
  /\bi (don't deserve|don't belong|can't do anything right)/i,
  /\bno one (likes|wants|cares about|loves) me\b/i,
  /\bi('m| am) (not good enough|too much|too needy|too sensitive)/i,
];

function normalize(text: string): string {
  return text.replace(/\u2019/g, "'").replace(/\u2018/g, "'").replace(/\u201c/g, '"').replace(/\u201d/g, '"');
}

function hasSelfCriticalLanguage(thought?: string): boolean {
  if (!thought) return false;
  const normalized = normalize(thought);
  return HARSH_PATTERNS.some(p => p.test(normalized));
}

export function generateSelfTalkInsight(atoms: ReflectionAtom[]): InsightCard | null {
  const thoughtAtoms = atoms.filter(a => a.automaticThought?.trim());
  if (thoughtAtoms.length < 2) return null;

  const harshAtoms = thoughtAtoms.filter(a => hasSelfCriticalLanguage(a.automaticThought));
  if (harshAtoms.length < 1) return null;

  const ratio = harshAtoms.length / thoughtAtoms.length;
  const isFrequent = ratio >= 0.5;

  return {
    id: uid(),
    templateId: "self_talk_pattern",
    title: "A pattern of self-critical language",
    observation: `In ${harshAtoms.length} of your ${thoughtAtoms.length} logged thoughts, the language you used about yourself was noticeably harsh.`,
    pattern: isFrequent
      ? "Self-critical language appears frequently in your automatic thoughts. This kind of inner voice tends to run faster and louder than the evidence actually supports."
      : "Self-critical language appears in some of your automatic thoughts. These moments are worth paying attention to — they often signal where you hold yourself to standards you wouldn't apply to others.",
    whyItMakesSense: "The inner critic often developed as a protective strategy — a way to motivate, avoid failure, or manage shame before others could point it out. It usually worked at some point, which is why it stuck.",
    experiment: "Take one self-critical statement you've written. Rewrite it the way you would speak to a close friend in the exact same situation. Notice the difference in tone. That gap is the room for growth.",
    confidence: calculateConfidence(harshAtoms.length),
  };
}
