import { supabase } from '../shared/supabase/client';

interface AmbientEntry {
  key: string;
  value: string;
  confidence: number;
}

function buildEntriesFromQuestionnaire(answers: Record<string, string | string[]>): AmbientEntry[] {
  const entries: AmbientEntry[] = [];

  const a = answers as Record<string, string>;

  if (a.lifeContext) {
    const ctx = a.lifeContext.toLowerCase();
    if (ctx.includes('tough') || ctx.includes('support')) {
      entries.push({ key: 'emotional_state', value: 'needs_support', confidence: 0.85 });
    } else if (ctx.includes('working') || ctx.includes('studying') || ctx.includes('motivation')) {
      entries.push({ key: 'emotional_state', value: 'motivated', confidence: 0.8 });
    } else if (ctx.includes('bored') || ctx.includes('lonely')) {
      entries.push({ key: 'emotional_state', value: 'lonely', confidence: 0.85 });
    } else if (ctx.includes('doing well') || ctx.includes('share')) {
      entries.push({ key: 'emotional_state', value: 'thriving', confidence: 0.8 });
    }
  }

  if (a.supportStyle) {
    const s = a.supportStyle.toLowerCase();
    if (s.includes('solution') || s.includes('fix')) {
      entries.push({ key: 'support_preference', value: 'problem_solver', confidence: 0.9 });
    } else if (s.includes('listen') || s.includes('validate')) {
      entries.push({ key: 'support_preference', value: 'listener', confidence: 0.9 });
    } else if (s.includes('distract') || s.includes('fun')) {
      entries.push({ key: 'support_preference', value: 'distract', confidence: 0.9 });
    } else if (s.includes('space')) {
      entries.push({ key: 'support_preference', value: 'space', confidence: 0.9 });
    }
  }

  if (a.loveLanguage) {
    const l = a.loveLanguage.toLowerCase();
    if (l.includes('words') || l.includes('affirmation')) {
      entries.push({ key: 'love_language', value: 'words_of_affirmation', confidence: 0.95 });
    } else if (l.includes('quality') || l.includes('time')) {
      entries.push({ key: 'love_language', value: 'quality_time', confidence: 0.95 });
    } else if (l.includes('gesture') || l.includes('gift')) {
      entries.push({ key: 'love_language', value: 'gifts', confidence: 0.95 });
    } else if (l.includes('acts') || l.includes('service')) {
      entries.push({ key: 'love_language', value: 'acts_of_service', confidence: 0.95 });
    }
  }

  if (a.conversationDepth) {
    const d = a.conversationDepth.toLowerCase();
    if (d.includes('fun') || d.includes('light')) {
      entries.push({ key: 'conversation_depth', value: 'light', confidence: 0.85 });
    } else if (d.includes('deep') || d.includes('meaningful')) {
      entries.push({ key: 'conversation_depth', value: 'deep', confidence: 0.85 });
    } else {
      entries.push({ key: 'conversation_depth', value: 'mixed', confidence: 0.7 });
    }
  }

  if (a.humorStyle) {
    const h = a.humorStyle.toLowerCase();
    if (h.includes('witty') || h.includes('clever')) {
      entries.push({ key: 'humor_style', value: 'witty', confidence: 0.9 });
    } else if (h.includes('goofy') || h.includes('silly')) {
      entries.push({ key: 'humor_style', value: 'goofy', confidence: 0.9 });
    } else if (h.includes('sarcastic') || h.includes('dry')) {
      entries.push({ key: 'humor_style', value: 'dry', confidence: 0.9 });
    } else if (h.includes('warm') || h.includes('light')) {
      entries.push({ key: 'humor_style', value: 'warm', confidence: 0.9 });
    }
  }

  if (a.energy) {
    const e = a.energy.toLowerCase();
    if (e.includes('life of the party')) {
      entries.push({ key: 'energy_preference', value: 'extrovert', confidence: 0.85 });
    } else if (e.includes('own world')) {
      entries.push({ key: 'energy_preference', value: 'introvert', confidence: 0.85 });
    } else {
      entries.push({ key: 'energy_preference', value: 'ambivert', confidence: 0.75 });
    }
  }

  if (a.availability) {
    const av = a.availability.toLowerCase();
    if (av.includes('always')) {
      entries.push({ key: 'availability_need', value: 'high', confidence: 0.9 });
    } else if (av.includes('mostly')) {
      entries.push({ key: 'availability_need', value: 'medium', confidence: 0.85 });
    } else if (av.includes('independent')) {
      entries.push({ key: 'availability_need', value: 'low', confidence: 0.85 });
    }
  }

  const hobbies = answers.hobbies;
  if (Array.isArray(hobbies)) {
    hobbies.forEach(hobby => {
      const key = `interest_${hobby.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 40)}`;
      entries.push({ key, value: 'true', confidence: 0.95 });
    });
  }

  const sports = answers.sports;
  if (Array.isArray(sports)) {
    sports.forEach(sport => {
      const key = `sport_${sport.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 40)}`;
      entries.push({ key, value: 'true', confidence: 0.95 });
    });
  }

  if (a.interests) {
    const int = a.interests.toLowerCase();
    if (int.includes('pop culture') || int.includes('social media')) {
      entries.push({ key: 'interest_category', value: 'pop_culture', confidence: 0.85 });
    } else if (int.includes('books') || int.includes('philosophy')) {
      entries.push({ key: 'interest_category', value: 'intellectual', confidence: 0.85 });
    } else if (int.includes('wellness') || int.includes('self-care') || int.includes('fitness')) {
      entries.push({ key: 'interest_category', value: 'wellness', confidence: 0.85 });
    } else if (int.includes('adventure') || int.includes('travel')) {
      entries.push({ key: 'interest_category', value: 'adventure', confidence: 0.85 });
    }
  }

  const newsTopics = answers.newsTopics;
  if (Array.isArray(newsTopics) && newsTopics.length > 0) {
    entries.push({ key: 'news_interest_count', value: String(newsTopics.length), confidence: 1.0 });
    entries.push({ key: 'prefers_news_brief', value: 'true', confidence: 0.8 });
  }

  if (a.connectionType) {
    const isRomantic = !a.connectionType.toLowerCase().includes('friend');
    entries.push({ key: 'connection_type', value: isRomantic ? 'romantic' : 'friendship', confidence: 1.0 });
  }

  return entries;
}

class AmbientProfileService {
  async seedFromQuestionnaire(
    userId: string,
    answers: Record<string, string | string[]>
  ): Promise<void> {
    try {
      const entries = buildEntriesFromQuestionnaire(answers);
      if (entries.length === 0) return;

      const now = new Date().toISOString();
      const rows = entries.map(e => ({
        user_id: userId,
        key: e.key,
        value: e.value,
        source: 'questionnaire',
        confidence: e.confidence,
        created_at: now,
        updated_at: now,
      }));

      await supabase
        .from('ambient_profile')
        .upsert(rows, { onConflict: 'user_id,key', ignoreDuplicates: false });
    } catch (err) {
      console.error('[AmbientProfileService] Failed to seed from questionnaire:', err);
    }
  }

  async getProfile(userId: string): Promise<Record<string, string>> {
    try {
      const { data } = await supabase
        .from('ambient_profile')
        .select('key, value')
        .eq('user_id', userId);

      if (!data) return {};
      return Object.fromEntries(data.map(r => [r.key, r.value]));
    } catch {
      return {};
    }
  }

  async upsertKey(
    userId: string,
    key: string,
    value: string,
    source: string = 'system',
    confidence: number = 0.8
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      await supabase
        .from('ambient_profile')
        .upsert(
          { user_id: userId, key, value, source, confidence, updated_at: now },
          { onConflict: 'user_id,key' }
        );
    } catch (err) {
      console.error('[AmbientProfileService] upsertKey failed:', err);
    }
  }
}

export const ambientProfileService = new AmbientProfileService();
