import { supabase } from '../shared/supabase/client';
import { createSeedMemory, QuestionnaireData } from './seedMemoryService';
import type { AvatarConfig } from '../types/avatar';
import { relationshipCalendarService } from './relationshipCalendarService';
import { affectionService } from './affectionService';
import type { RelationshipIntent, RelationshipStatus } from './affectionService';
import { FONT_OPTIONS, getEligibleFonts } from './customizationService';
import { getCurrentStatus } from '../utils/statusHelper';
import { seedVoiceBaseline } from './voiceFidelityService';

export interface Companion {
  id: string;
  user_id: string;
  gender: 'male' | 'female';
  relationship_type: 'friend' | 'romantic' | 'mentor';
  font_family?: string | null;
  created_at: string;
  last_message_at: string;
  is_active: boolean;
  first_message_sent: boolean;
  first_message_claimed_at?: string | null;
  custom_name: string;
  hobbies: string[];
  sports: string[];
  dynamic_preference?: string;
  confrontation_style?: string;
  availability_level?: string;
  interest_preference?: string;
  signature_voice?: string;
  signature_expert?: string | null;
  signature_expert_source?: string | null;
  interest_text?: string;
  love_language?: string;
  support_style?: string;
  life_context?: string;
  energy_preference?: string;
  favorite_color?: string;
  zodiac_sign?: string;
  music_genre?: string;
  news_categories?: string[];
  flirting_style?: string;
  humor_style?: string;
  communication_style?: string;
  emotional_openness?: string;
  conversation_depth?: string;
  expressiveness?: string;
  initiative?: string;
  avatar_config?: AvatarConfig;
  chat_wallpaper?: string | null;
  chat_wallpaper_url?: string | null;
  chat_bubble_color?: string | null;
  chat_text_color?: string | null;
  companion_bubble_color?: string | null;
  companion_text_color?: string | null;
  voice_baseline?: string | null;
  drift_vfs?: number | null;
  drift_needs_correction?: boolean | null;
  drift_checked_at?: string | null;
}

export interface CompanionWithLastMessage extends Companion {
  last_message_text?: string;
  last_message_role?: 'user' | 'assistant';
  unread_count?: number;
  current_status?: string;
}

export interface CreateCompanionOptions {
  userId: string;
  gender: 'male' | 'female';
  relationshipType: 'friend' | 'romantic' | 'mentor';
  customName: string;
  hobbies: string[];
  sports?: string[];
  dynamicPreference?: string;
  confrontationStyle?: string;
  availabilityLevel?: string;
  interestPreference?: string;
  signatureVoice?: string;
  signatureExpert?: string;
  signatureExpertSource?: 'curated' | 'user';
  interestText?: string;
  loveLanguage?: string;
  supportStyle?: string;
  lifeContext?: string;
  energyPreference?: string;
  favoriteColor?: string;
  zodiacSign?: string;
  musicGenre?: string;
  newsCategories?: string[];
  flirtingStyle?: string;
  humorStyle?: string;
  communicationStyle?: string;
  emotionalOpenness?: string;
  conversationDepth?: string;
  expressiveness?: string;
  initiative?: string;
  questionnaireData?: QuestionnaireData;
}

export async function assignCompanionFont(userId: string, gender: 'male' | 'female'): Promise<string> {
  const { data: activeCompanions } = await supabase
    .from('companions')
    .select('font_family')
    .eq('user_id', userId)
    .eq('is_active', true);

  const takenFonts = new Set(
    (activeCompanions ?? []).map(c => c.font_family).filter(Boolean)
  );

  const eligible = getEligibleFonts(gender);
  const available = eligible.filter(f => !takenFonts.has(f.fontFamily));
  const pool = available.length > 0 ? available : eligible;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return picked.fontFamily;
}

export async function updateCompanionFont(companionId: string, fontFamily: string): Promise<void> {
  const { error } = await supabase
    .from('companions')
    .update({ font_family: fontFamily })
    .eq('id', companionId);
  if (error) return;
}

export async function updateCompanionChatStyle(companionId: string, style: {
  chat_bubble_color?: string | null;
  chat_text_color?: string | null;
  companion_bubble_color?: string | null;
  companion_text_color?: string | null;
  font_family?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from('companions')
    .update(style)
    .eq('id', companionId);
  if (error) return;
}

export async function createCompanion(options: CreateCompanionOptions): Promise<Companion | null> {
  const fontFamily = await assignCompanionFont(options.userId, options.gender);

  const { data, error } = await supabase
    .from('companions')
    .insert({
      user_id: options.userId,
      gender: options.gender,
      font_family: fontFamily,
      relationship_type: options.relationshipType,
      custom_name: options.customName,
      hobbies: options.hobbies,
      sports: options.sports || [],
      dynamic_preference: options.dynamicPreference,
      confrontation_style: options.confrontationStyle,
      availability_level: options.availabilityLevel,
      interest_preference: options.interestPreference,
      signature_voice: options.relationshipType === 'mentor'
        ? (options.gender === 'male' ? 'classic_male' : 'classic_female')
        : (options.signatureVoice || (options.gender === 'male' ? 'classic_male' : 'classic_female')),
      signature_expert: options.signatureExpert || null,
      signature_expert_source: options.signatureExpertSource || null,
      interest_text: options.interestText,
      love_language: options.loveLanguage,
      support_style: options.supportStyle,
      life_context: options.lifeContext,
      energy_preference: options.energyPreference,
      favorite_color: options.favoriteColor,
      zodiac_sign: options.zodiacSign,
      music_genre: options.musicGenre,
      news_categories: options.newsCategories || [],
      flirting_style: options.flirtingStyle,
      humor_style: options.humorStyle,
      communication_style: options.communicationStyle,
      emotional_openness: options.emotionalOpenness,
      conversation_depth: options.conversationDepth,
      expressiveness: options.expressiveness,
      initiative: options.initiative,
      first_message_sent: false,
      is_active: true,
      last_message_at: new Date().toISOString()
    })
    .select()
    .maybeSingle();

  if (error) {
    return null;
  }

  if (data) {
    try {
      const relationshipIntent: RelationshipIntent =
        options.relationshipType === 'friend' ? 'friend' :
        options.relationshipType === 'mentor' ? 'friend' :
        options.relationshipType === 'romantic' ? 'companion' : 'evolve';

      const relationshipStatus: RelationshipStatus = affectionService.getDefaultStatus(relationshipIntent);
      const affectionBase = affectionService.getDefaultBase(relationshipIntent);

      const { error: statsError } = await supabase
        .from('relationship_stats')
        .insert({
          user_id: options.userId,
          companion_id: data.id,
          relationship_intent: relationshipIntent,
          relationship_status: relationshipStatus,
          affection_base: affectionBase,
          affection_last_updated_at: new Date().toISOString()
        });

    } catch {
    }
  }

  if (data && options.questionnaireData) {
    try {
      await createSeedMemory(
        options.userId,
        data.id,
        options.questionnaireData,
        options.gender
      );
    } catch {
    }
  }

  if (data) {
    const voiceId = options.signatureVoice || (options.gender === 'male' ? 'classic_male' : 'classic_female');
    seedVoiceBaseline(data.id, voiceId, options.gender).catch(console.error);
  }

  if (data) {
    try {
      await relationshipCalendarService.createAnchorEvent(
        options.userId,
        data.id,
        options.customName,
        new Date(data.created_at)
      );
    } catch {
    }
  }

  return data;
}

export async function getCompanions(userId: string): Promise<CompanionWithLastMessage[]> {
  const { data: companions, error } = await supabase
    .from('companions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false });

  if (error) {
    return [];
  }

  const takenFonts = new Set(
    companions.filter(c => c.font_family).map(c => c.font_family as string)
  );

  const today = new Date().toISOString().split('T')[0];

  const companionsWithMessages = await Promise.all(
    companions.map(async (companion) => {
      const [{ data: lastMessage }, { data: dailyExp }] = await Promise.all([
        supabase
          .from('conversations')
          .select('content, role, created_at')
          .eq('companion_id', companion.id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('daily_experiences')
          .select('status_timeline')
          .eq('companion_id', companion.id)
          .eq('date', today)
          .maybeSingle(),
      ]);

      let fontFamily = companion.font_family;

      if (!fontFamily) {
        const eligible = getEligibleFonts(companion.gender);
        const available = eligible.filter(f => !takenFonts.has(f.fontFamily));
        const pool = available.length > 0 ? available : eligible;
        const picked = pool[Math.floor(Math.random() * pool.length)];
        fontFamily = picked.fontFamily;
        takenFonts.add(fontFamily);
        supabase
          .from('companions')
          .update({ font_family: fontFamily })
          .eq('id', companion.id)
          .then(() => {});
      }

      let current_status: string | undefined;
      if (dailyExp?.status_timeline && dailyExp.status_timeline.length > 0) {
        const statusEntry = getCurrentStatus(dailyExp.status_timeline);
        current_status = statusEntry?.status ?? undefined;
      }

      return {
        ...companion,
        font_family: fontFamily,
        last_message_text: lastMessage?.content,
        last_message_role: lastMessage?.role,
        unread_count: 0,
        current_status,
      };
    })
  );

  return companionsWithMessages;
}

export async function getCompanion(companionId: string): Promise<Companion | null> {
  const { data, error } = await supabase
    .from('companions')
    .select('*')
    .eq('id', companionId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

export async function updateLastMessageTime(companionId: string): Promise<void> {
  const { error } = await supabase
    .from('companions')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', companionId);

  if (error) {
    return;
  }
}

export async function markFirstMessageSent(companionId: string): Promise<void> {
  const { error } = await supabase
    .from('companions')
    .update({ first_message_sent: true })
    .eq('id', companionId);

  if (error) {
    return;
  }
}

export async function claimFirstMessage(companionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_first_message', { p_companion_id: companionId });
  if (error) throw error;
  return Boolean(data);
}

export async function finalizeFirstMessage(companionId: string): Promise<void> {
  const { error } = await supabase.rpc('finalize_first_message', { p_companion_id: companionId });
  if (error) throw error;
}

export async function deactivateCompanion(companionId: string): Promise<void> {
  const { error } = await supabase
    .from('companions')
    .update({ is_active: false })
    .eq('id', companionId);

  if (error) {
    return;
  }
}

export async function getUserDefaultCompanion(userId: string): Promise<Companion | null> {
  const { data, error } = await supabase
    .from('companions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}
