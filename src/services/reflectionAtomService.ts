import { supabase } from '../shared/supabase/client';

export interface NewReflectionAtom {
  situation?: string;
  automaticThought?: string;
  emotion?: string;
  emotionIntensity?: number;
  bodySignal?: string;
  behavior?: string;
  outcome?: string;
  tags?: string[];
}

export async function saveReflectionAtom(atom: NewReflectionAtom): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('reflection_atoms').insert({
    user_id: user.id,
    timestamp: Date.now(),
    situation: atom.situation || null,
    automatic_thought: atom.automaticThought || null,
    emotion: atom.emotion || null,
    emotion_intensity: atom.emotionIntensity ?? null,
    body_signal: atom.bodySignal || null,
    behavior: atom.behavior || null,
    outcome: atom.outcome || null,
    tags: atom.tags && atom.tags.length > 0 ? atom.tags : null,
  });

  if (error) throw error;
}

export interface InsertReflectionAtomInput {
  timestamp: number;
  situation: string;
  automaticThought: string;
  emotion?: string;
  emotionIntensity: number;
  bodySignal?: string;
  behavior?: string;
  outcome?: string;
  tags?: string[];
}

export async function insertReflectionAtom(atom: InsertReflectionAtomInput): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('reflection_atoms').insert({
    user_id: user.id,
    timestamp: atom.timestamp,
    situation: atom.situation,
    automatic_thought: atom.automaticThought,
    emotion: atom.emotion ?? null,
    emotion_intensity: atom.emotionIntensity,
    body_signal: atom.bodySignal ?? null,
    behavior: atom.behavior ?? null,
    outcome: atom.outcome ?? null,
    tags: atom.tags && atom.tags.length > 0 ? atom.tags : null,
  });

  if (error) throw error;
}
