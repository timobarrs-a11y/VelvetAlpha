export type InsightConfidence = 'starter' | 'early' | 'confirmed';

export interface ReflectionAtom {
  id: string;
  timestamp: number;

  situation?: string;
  automaticThought?: string;
  emotion?: string;
  emotionIntensity?: number;
  bodySignal?: string;
  behavior?: string;
  outcome?: string;

  tags?: string[];
}

export interface InsightCard {
  id: string;
  templateId: string;
  title: string;
  observation: string;
  pattern: string;
  whyItMakesSense: string;
  experiment: string;
  confidence: InsightConfidence;
}
