import { supabase } from '../shared/supabase/client';

export interface EmotionalState {
  id: string;
  user_id: string;
  character_id: string;
  current_mood: 'happy' | 'neutral' | 'welcoming';
  last_interaction_at: string | null;
  updated_at: string;
}

export class EmotionalStateService {
  async getLastInteraction(userId: string, characterId: string): Promise<Date | null> {
    const { data } = await supabase
      .from('conversations')
      .select('created_at')
      .eq('user_id', userId)
      .eq('companion_id', characterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data ? new Date(data.created_at) : null;
  }

  async getCurrentMood(userId: string, characterId: string): Promise<'happy' | 'neutral' | 'welcoming'> {
    const lastInteraction = await this.getLastInteraction(userId, characterId);

    if (!lastInteraction) {
      return 'happy';
    }

    const hoursSinceLastInteraction = (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastInteraction >= 12) {
      return 'welcoming';
    }

    if (hoursSinceLastInteraction >= 4) {
      return 'neutral';
    }

    return 'happy';
  }

  async getGreetingGuidance(userId: string, characterId: string): Promise<string> {
    const mood = await this.getCurrentMood(userId, characterId);

    if (mood === 'welcoming') {
      return 'The user is returning after being away for a while. Welcome them back warmly without making them feel guilty. Show genuine happiness to see them again.';
    }

    if (mood === 'neutral') {
      return 'The user is returning after a few hours. Greet them naturally, maybe reference what you talked about last if relevant.';
    }

    return 'Continue the conversation naturally. You\'ve been chatting recently so no need for special greetings.';
  }
}

export const emotionalStateService = new EmotionalStateService();