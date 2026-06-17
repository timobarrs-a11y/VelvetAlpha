import { supabase } from '../shared/supabase/client';
import { ExpertConfig, getExpertById } from '../config/signatureExperts';

export interface UserExpert {
  id: string;
  user_id: string;
  name: string;
  domain: string;
  category: string;
  description: string;
  instruction: string;
  goal_types: string[];
  check_in_style: string;
  accountability_level: string;
  sample_interaction: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UserExpertInput = Omit<UserExpert, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /new\s+system\s+prompt/i,
  /override[:\s]/i,
  /forget\s+everything/i,
  /you\s+are\s+now/i,
  /disregard\s+(all\s+)?(above|prior)/i,
  /\bsystem\s*:/i,
  /\bassistant\s*:/i,
  /\buser\s*:/i,
  /<\/?system>/i,
  /<\/?instruction>/i,
  /<\/?prompt>/i,
];

export function sanitizeExpertInstruction(raw: string, charLimit: number): string {
  let sanitized = raw.slice(0, charLimit);

  sanitized = sanitized.replace(/<\/?[a-z_-]+>/gi, '');

  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[removed]');
  }

  sanitized = sanitized.replace(/\$\{[^}]*\}/g, '');

  return sanitized.trim();
}

export function userExpertToConfig(expert: UserExpert): ExpertConfig {
  return {
    id: expert.id,
    name: expert.name,
    domain: expert.domain,
    category: expert.category as ExpertConfig['category'],
    description: expert.description,
    instruction: expert.instruction,
    goalTypes: expert.goal_types,
    checkInStyle: expert.check_in_style as ExpertConfig['checkInStyle'],
    accountabilityLevel: expert.accountability_level as ExpertConfig['accountabilityLevel'],
    sampleInteraction: expert.sample_interaction,
    premium: false,
    source: 'user',
  };
}

export async function resolveExpert(
  expertId: string | null | undefined,
  source: string | null | undefined,
  userId?: string
): Promise<ExpertConfig | null> {
  if (!expertId) return null;

  if (source === 'curated' || !source) {
    const curated = getExpertById(expertId);
    if (curated) return curated;
  }

  if (source === 'user' && userId) {
    const { data } = await supabase
      .from('user_experts')
      .select('*')
      .eq('id', expertId)
      .eq('user_id', userId)
      .maybeSingle();

    if (data) return userExpertToConfig(data as UserExpert);
  }

  return null;
}

export async function getUserExperts(userId: string): Promise<UserExpert[]> {
  const { data } = await supabase
    .from('user_experts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  return (data ?? []) as UserExpert[];
}

export async function createUserExpert(userId: string, input: UserExpertInput): Promise<UserExpert | null> {
  const { data } = await supabase
    .from('user_experts')
    .insert({ ...input, user_id: userId })
    .select()
    .maybeSingle();
  return data as UserExpert | null;
}

export async function updateUserExpert(
  userId: string,
  expertId: string,
  updates: Partial<UserExpertInput>
): Promise<UserExpert | null> {
  const { data } = await supabase
    .from('user_experts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', expertId)
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  return data as UserExpert | null;
}

export async function deleteUserExpert(userId: string, expertId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_experts')
    .delete()
    .eq('id', expertId)
    .eq('user_id', userId);
  return !error;
}
