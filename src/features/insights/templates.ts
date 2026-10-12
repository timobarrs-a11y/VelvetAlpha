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
  profile_interests: 'Generated from the hobbies, entertainment, lifestyle, and tech interests you selected during setup. This is your baseline interest profile — it evolves as you chat.',
  profile_music: 'Your music genre preference from setup, interpreted as an emotional anchor pattern. Music taste often mirrors what you need to feel.',
  profile_communication: 'Derived from your communication style answers during setup — how you handle conflict, how you connect, how you make decisions, and what drives you.',
  profile_sports: 'Your sports and athletic interests from setup, interpreted as a window into how you engage with competition, mastery, and goals.',
  profile_tech: 'Your technology interests from setup, revealing curiosity patterns and how you relate to innovation and systems thinking.',
  profile_zodiac: 'A lighthearted personality snapshot based on your zodiac sign. Not science, but a shared cultural language for self-reflection.',
  profile_color: 'Your favorite color from setup. Color preference is surprisingly stable across a lifetime and often reflects temperament.',
};
