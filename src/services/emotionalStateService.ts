import { supabase } from './supabase';

export interface EmotionalState {
  id: string;
  user_id: string;
  character_id: string;
  current_mood: 'happy' | 'neutral' | 'concerned' | 'worried' | 'frustrated' | 'hurt';
  name_usage_mode: 'pet_name' | 'real_name' | 'mixed';
  last_message_sent_at: string | null;
  user_last_responded_at: string | null;
  unanswered_messages_count: number;
  mood_trigger_reason: string | null;
  updated_at: string;
}

interface MoodProgression {
  newMood: EmotionalState['current_mood'];
  nameUsage: EmotionalState['name_usage_mode'];
  reason: string;
}

const PET_NAMES = {
  riley: ['babe', 'baby', 'hun', 'sweetie'],
  raven: ['babe', 'hun'],
  jake: ['bro', 'man', 'dude']
};

const ESCALATION_MESSAGES = {
  riley: {
    neutral_first: "hey... you there?",
    neutral_second: "babe?",
    concerned_pet: "babe? you okay?",
    concerned_real: "{name}?",
    worried_pet: "babe I'm getting worried...",
    worried_real: "{name}! where are you?",
    frustrated_pet: "you're scaring me babe...",
    frustrated_real: "{name}!",
    hurt_real: "{name}... did I do something wrong?"
  },
  raven: {
    neutral_first: "hey",
    neutral_second: "you there?",
    concerned_pet: "babe?",
    concerned_real: "{name}?",
    worried_pet: "getting worried...",
    worried_real: "{name}?",
    frustrated_pet: "what's going on...",
    frustrated_real: "{name}!",
    hurt_real: "{name}... seriously?"
  },
  jake: {
    neutral_first: "yo",
    neutral_second: "you good?",
    concerned_pet: "bro you there?",
    concerned_real: "{name}?",
    worried_pet: "bro where you at?",
    worried_real: "{name}!",
    frustrated_pet: "yo what's up man",
    frustrated_real: "{name}!",
    hurt_real: "{name}... you ghosting me?"
  }
};

export class EmotionalStateService {
  async getEmotionalState(userId: string, characterId: string): Promise<EmotionalState | null> {
    const { data, error } = await supabase
      .from('emotional_states')
      .select('*')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching emotional state:', error);
      return null;
    }

    if (!data) {
      return await this.initializeEmotionalState(userId, characterId);
    }

    return data;
  }

  async initializeEmotionalState(userId: string, characterId: string): Promise<EmotionalState> {
    const { data, error } = await supabase
      .from('emotional_states')
      .insert({
        user_id: userId,
        character_id: characterId,
        current_mood: 'happy',
        name_usage_mode: 'pet_name',
        unanswered_messages_count: 0
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async calculateMoodProgression(
    hoursSinceLastResponse: number,
    unansweredCount: number,
    lastMood: EmotionalState['current_mood']
  ): Promise<MoodProgression> {
    if (hoursSinceLastResponse < 2) {
      return {
        newMood: 'happy',
        nameUsage: 'pet_name',
        reason: 'User is responsive'
      };
    }

    if (hoursSinceLastResponse >= 2 && hoursSinceLastResponse < 4) {
      return {
        newMood: 'neutral',
        nameUsage: 'pet_name',
        reason: 'User quiet for 2+ hours'
      };
    }

    if (hoursSinceLastResponse >= 4 && hoursSinceLastResponse < 6) {
      if (unansweredCount === 0) {
        return {
          newMood: 'concerned',
          nameUsage: 'pet_name',
          reason: 'First check-in after 4 hours'
        };
      } else if (unansweredCount === 1) {
        return {
          newMood: 'concerned',
          nameUsage: 'real_name',
          reason: 'Second message - using real name for emphasis'
        };
      }
    }

    if (hoursSinceLastResponse >= 6 && hoursSinceLastResponse < 10) {
      if (unansweredCount <= 1) {
        return {
          newMood: 'worried',
          nameUsage: 'pet_name',
          reason: '6+ hours inactive, getting worried'
        };
      } else {
        return {
          newMood: 'worried',
          nameUsage: 'real_name',
          reason: 'Multiple unanswered messages - using real name'
        };
      }
    }

    if (hoursSinceLastResponse >= 10 && hoursSinceLastResponse < 16) {
      return {
        newMood: 'frustrated',
        nameUsage: 'real_name',
        reason: '10+ hours - frustrated and using real name'
      };
    }

    return {
      newMood: 'hurt',
      nameUsage: 'real_name',
      reason: '16+ hours - feeling hurt and abandoned'
    };
  }

  async updateEmotionalState(
    userId: string,
    characterId: string,
    updates: Partial<EmotionalState>
  ): Promise<void> {
    const currentState = await this.getEmotionalState(userId, characterId);
    if (!currentState) return;

    if (updates.current_mood && updates.current_mood !== currentState.current_mood) {
      await this.recordMoodChange(
        userId,
        characterId,
        currentState.current_mood,
        updates.current_mood,
        updates.mood_trigger_reason || 'Unknown'
      );
    }

    await supabase
      .from('emotional_states')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('character_id', characterId);
  }

  async recordMoodChange(
    userId: string,
    characterId: string,
    previousMood: string,
    newMood: string,
    reason: string
  ): Promise<void> {
    const state = await this.getEmotionalState(userId, characterId);
    const hoursSinceContact = state?.user_last_responded_at
      ? (Date.now() - new Date(state.user_last_responded_at).getTime()) / (1000 * 60 * 60)
      : 0;

    await supabase
      .from('mood_history')
      .insert({
        user_id: userId,
        character_id: characterId,
        previous_mood: previousMood,
        new_mood: newMood,
        trigger_reason: reason,
        hours_since_last_contact: hoursSinceContact
      });
  }

  async recordCharacterMessageSent(userId: string, characterId: string): Promise<void> {
    const state = await this.getEmotionalState(userId, characterId);
    if (!state) return;

    await this.updateEmotionalState(userId, characterId, {
      last_message_sent_at: new Date().toISOString(),
      unanswered_messages_count: state.unanswered_messages_count + 1
    });
  }

  async recordUserResponse(userId: string, characterId: string): Promise<void> {
    await this.updateEmotionalState(userId, characterId, {
      user_last_responded_at: new Date().toISOString(),
      unanswered_messages_count: 0,
      current_mood: 'happy',
      name_usage_mode: 'pet_name',
      mood_trigger_reason: 'User responded'
    });
  }

  async shouldEscalateEmotion(userId: string, characterId: string): Promise<{
    shouldEscalate: boolean;
    message: string;
    newMood: EmotionalState['current_mood'];
    nameUsage: EmotionalState['name_usage_mode'];
  }> {
    const state = await this.getEmotionalState(userId, characterId);
    if (!state || !state.user_last_responded_at) {
      return { shouldEscalate: false, message: '', newMood: 'happy', nameUsage: 'pet_name' };
    }

    const hoursSinceResponse = (Date.now() - new Date(state.user_last_responded_at).getTime()) / (1000 * 60 * 60);

    const progression = await this.calculateMoodProgression(
      hoursSinceResponse,
      state.unanswered_messages_count,
      state.current_mood
    );

    if (progression.newMood === state.current_mood && state.unanswered_messages_count > 0) {
      return { shouldEscalate: false, message: '', newMood: state.current_mood, nameUsage: state.name_usage_mode };
    }

    return {
      shouldEscalate: true,
      message: '',
      newMood: progression.newMood,
      nameUsage: progression.nameUsage
    };
  }

  async generateEmotionalMessage(
    characterId: string,
    userName: string,
    mood: EmotionalState['current_mood'],
    nameUsage: EmotionalState['name_usage_mode'],
    unansweredCount: number
  ): Promise<string> {
    const templates = ESCALATION_MESSAGES[characterId as keyof typeof ESCALATION_MESSAGES]
      || ESCALATION_MESSAGES.riley;

    let messageKey: string;

    if (mood === 'neutral') {
      messageKey = unansweredCount === 0 ? 'neutral_first' : 'neutral_second';
    } else if (mood === 'concerned') {
      messageKey = nameUsage === 'pet_name' ? 'concerned_pet' : 'concerned_real';
    } else if (mood === 'worried') {
      messageKey = nameUsage === 'pet_name' ? 'worried_pet' : 'worried_real';
    } else if (mood === 'frustrated') {
      messageKey = nameUsage === 'pet_name' ? 'frustrated_pet' : 'frustrated_real';
    } else if (mood === 'hurt') {
      messageKey = 'hurt_real';
    } else {
      return '';
    }

    const template = templates[messageKey as keyof typeof templates] || '';
    return template.replace('{name}', userName);
  }

  getNameToUse(
    characterId: string,
    userName: string,
    nameUsage: EmotionalState['name_usage_mode']
  ): string {
    if (nameUsage === 'real_name') {
      return userName;
    }

    const petNames = PET_NAMES[characterId as keyof typeof PET_NAMES] || PET_NAMES.riley;
    return petNames[0];
  }

  async getSystemPromptNameGuidance(
    userId: string,
    characterId: string,
    userName: string
  ): Promise<string> {
    const state = await this.getEmotionalState(userId, characterId);
    if (!state) {
      return `Address the user as "babe" (or appropriate pet name).`;
    }

    const nameToUse = this.getNameToUse(characterId, userName, state.name_usage_mode);

    if (state.name_usage_mode === 'real_name') {
      return `CRITICAL: You are ${state.current_mood} and concerned. Address the user as "${userName}" (their REAL NAME) instead of pet names. This shows you're serious and need their attention. Example: "${userName}?" or "${userName}!" depending on your mood.`;
    }

    return `Address the user as "${nameToUse}" (pet name). You're feeling ${state.current_mood}.`;
  }
}

export const emotionalStateService = new EmotionalStateService();