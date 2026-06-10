export const INSIGHT_TEMPLATES = [
  { id: "thought_intensity_pattern", minAtoms: 2 },
  { id: "avoidance_pattern", minAtoms: 1 },
  { id: "core_need_pattern", minAtoms: 3 },
  { id: "emotion_frequency_pattern", minAtoms: 1 },
  { id: "self_talk_pattern", minAtoms: 2 },
  { id: "behavior_loop_pattern", minAtoms: 3 }
] as const;

export type InsightTemplateId = typeof INSIGHT_TEMPLATES[number]["id"];

export const INSIGHT_TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  emotion_frequency_pattern: 'Tracks the most frequently logged emotion across your reflections. Recurring emotions often point to unresolved themes or meaningful triggers.',
  avoidance_pattern: 'Identifies moments where your logged behavior involved stepping away from something rather than toward it. Avoidance is one of the most common coping patterns in CBT.',
  behavior_loop_pattern: 'Detects whether your behaviors are leading to different outcomes over time, or repeating in cycles. Behavior loops are a core concept in CBT for understanding stuck patterns.',
  thought_intensity_pattern: 'Identifies cognitive distortions — specific thinking styles like catastrophizing or all-or-nothing thinking — in your automatic thoughts.',
  core_need_pattern: 'Surfaces the underlying psychological need (safety, validation, control, or connection) that appears most often across your reflections.',
  self_talk_pattern: 'Flags harsh, self-critical language in your automatic thought fields. Research shows that the tone of inner self-talk significantly affects emotional regulation.',
};
