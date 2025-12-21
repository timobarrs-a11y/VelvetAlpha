import { supabase } from './supabase';

export interface EmotionalProfile {
  id: string;
  user_id: string;
  baseline_mood: string;
  stress_triggers: string[];
  joy_triggers: string[];
  communication_style: string;
  support_preferences: string;
  humor_style: string;
  vulnerability_level: string;
  response_patterns: Record<string, any>;
  peak_activity_times: string[];
  updated_at: string;
}

export class EmotionalProfileService {
  static async updateProfile(
    userId: string,
    userMessage: string,
    aiResponse: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<void> {
    try {
      const { data: profile } = await supabase
        .from('emotional_profile')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile) {
        await this.createInitialProfile(userId);
        return;
      }

      const updates = this.analyzeAndGenerateUpdates(profile, userMessage, aiResponse, conversationHistory);

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('emotional_profile')
          .update(updates)
          .eq('user_id', userId);
      }
    } catch (error) {
      console.error('Error updating emotional profile:', error);
    }
  }

  private static async createInitialProfile(userId: string): Promise<void> {
    try {
      await supabase
        .from('emotional_profile')
        .insert({
          user_id: userId,
          baseline_mood: 'neutral',
          stress_triggers: [],
          joy_triggers: [],
          communication_style: 'casual',
          support_preferences: 'balanced',
          humor_style: 'playful',
          vulnerability_level: 'moderate',
          response_patterns: {},
          peak_activity_times: [],
        });
    } catch (error) {
      console.error('Error creating initial profile:', error);
    }
  }

  private static analyzeAndGenerateUpdates(
    profile: EmotionalProfile,
    userMessage: string,
    aiResponse: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Partial<EmotionalProfile> {
    const updates: Partial<EmotionalProfile> = {};
    const lowerMessage = userMessage.toLowerCase();

    const stressTriggers = [
      'work', 'boss', 'deadline', 'exam', 'test', 'interview',
      'bills', 'money', 'debt', 'fight', 'argument', 'family drama'
    ];

    const detectedStressTriggers = stressTriggers.filter(trigger =>
      lowerMessage.includes(trigger) &&
      ['stressed', 'anxious', 'worried', 'scared', 'overwhelmed', 'panic'].some(emotion =>
        lowerMessage.includes(emotion)
      )
    );

    if (detectedStressTriggers.length > 0) {
      const currentTriggers = profile.stress_triggers || [];
      const newTriggers = [...new Set([...currentTriggers, ...detectedStressTriggers])].slice(0, 10);
      updates.stress_triggers = newTriggers;
    }

    const joyTriggers = [
      'success', 'achievement', 'promotion', 'passed', 'won', 'celebration',
      'vacation', 'weekend', 'friends', 'hobby', 'music', 'food', 'pets'
    ];

    const detectedJoyTriggers = joyTriggers.filter(trigger =>
      lowerMessage.includes(trigger) &&
      ['happy', 'excited', 'love', 'great', 'amazing', 'wonderful'].some(emotion =>
        lowerMessage.includes(emotion)
      )
    );

    if (detectedJoyTriggers.length > 0) {
      const currentTriggers = profile.joy_triggers || [];
      const newTriggers = [...new Set([...currentTriggers, ...detectedJoyTriggers])].slice(0, 10);
      updates.joy_triggers = newTriggers;
    }

    const communicationPatterns = {
      brief: userMessage.split(/\s+/).length < 10,
      detailed: userMessage.split(/\s+/).length > 30,
      emoji_heavy: (userMessage.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length > 2,
      formal: /please|thank you|appreciate|grateful/i.test(userMessage),
      casual: /lol|haha|yeah|nah|gonna|wanna/i.test(userMessage),
    };

    if (communicationPatterns.brief && !communicationPatterns.detailed) {
      updates.communication_style = 'brief';
    } else if (communicationPatterns.detailed) {
      updates.communication_style = 'detailed';
    } else if (communicationPatterns.casual) {
      updates.communication_style = 'casual';
    } else if (communicationPatterns.formal) {
      updates.communication_style = 'formal';
    }

    const supportIndicators = {
      advice_seeking: /what should i|should i|help me decide|your advice|what do you think/i.test(lowerMessage),
      emotional_support: /just need|just want to talk|listen|understand|feel/i.test(lowerMessage),
      practical_help: /how do i|steps to|guide me|show me how/i.test(lowerMessage),
      validation: /am i|is it okay|is it wrong|do you think i'm/i.test(lowerMessage),
    };

    if (supportIndicators.advice_seeking) {
      updates.support_preferences = 'advice-focused';
    } else if (supportIndicators.emotional_support) {
      updates.support_preferences = 'emotional-support';
    } else if (supportIndicators.practical_help) {
      updates.support_preferences = 'practical-help';
    } else if (supportIndicators.validation) {
      updates.support_preferences = 'validation';
    }

    const humorIndicators = {
      sarcastic: /yeah right|sure thing|oh great/i.test(lowerMessage) && lowerMessage.length < 30,
      playful: /haha|lol|😂|🤣|funny/i.test(lowerMessage),
      dry: userMessage.includes('.') && !lowerMessage.includes('haha') && !lowerMessage.includes('lol'),
      witty: conversationHistory.slice(-3).some(m =>
        m.role === 'assistant' && /clever|smart|witty/i.test(userMessage)
      ),
    };

    if (humorIndicators.playful) {
      updates.humor_style = 'playful';
    } else if (humorIndicators.sarcastic) {
      updates.humor_style = 'sarcastic';
    } else if (humorIndicators.witty) {
      updates.humor_style = 'witty';
    } else if (humorIndicators.dry) {
      updates.humor_style = 'dry';
    }

    const vulnerabilityMarkers = [
      'i feel', 'i\'m scared', 'i\'m worried', 'i\'m sad', 'i\'m depressed',
      'i\'m anxious', 'i need', 'i miss', 'i hate', 'i love', 'honestly',
      'to be honest', 'truth is', 'i\'m afraid', 'can i tell you'
    ];

    const vulnerabilityCount = vulnerabilityMarkers.filter(marker =>
      lowerMessage.includes(marker)
    ).length;

    if (vulnerabilityCount >= 2) {
      updates.vulnerability_level = 'high';
    } else if (vulnerabilityCount === 1) {
      updates.vulnerability_level = 'moderate';
    } else if (lowerMessage.length > 20 && vulnerabilityCount === 0) {
      updates.vulnerability_level = 'reserved';
    }

    const currentHour = new Date().getHours();
    const timeSlot = this.getTimeSlot(currentHour);
    const currentTimes = profile.peak_activity_times || [];

    if (!currentTimes.includes(timeSlot)) {
      const updatedTimes = [...currentTimes, timeSlot].slice(-10);
      updates.peak_activity_times = updatedTimes;
    }

    const moodIndicators = conversationHistory.slice(-10).filter(m => m.role === 'user');
    const moodCounts = {
      positive: 0,
      negative: 0,
      neutral: 0,
    };

    for (const msg of moodIndicators) {
      const lower = msg.content.toLowerCase();
      if (['happy', 'great', 'excited', 'love', 'amazing'].some(w => lower.includes(w))) {
        moodCounts.positive++;
      } else if (['sad', 'depressed', 'anxious', 'worried', 'stressed'].some(w => lower.includes(w))) {
        moodCounts.negative++;
      } else {
        moodCounts.neutral++;
      }
    }

    if (moodCounts.positive > moodCounts.negative && moodCounts.positive > moodCounts.neutral) {
      updates.baseline_mood = 'positive';
    } else if (moodCounts.negative > moodCounts.positive) {
      updates.baseline_mood = 'stressed';
    } else {
      updates.baseline_mood = 'neutral';
    }

    return updates;
  }

  private static getTimeSlot(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  static async getProfile(userId: string): Promise<EmotionalProfile | null> {
    try {
      const { data, error } = await supabase
        .from('emotional_profile')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting emotional profile:', error);
      return null;
    }
  }

  static formatProfileForContext(profile: EmotionalProfile | null): string {
    if (!profile) return '';

    let context = '\n\n🎭 EMOTIONAL PROFILE & PREFERENCES:';

    context += `\n\nBaseline mood: ${profile.baseline_mood}`;
    context += `\nCommunication style: ${profile.communication_style}`;
    context += `\nSupport preference: ${profile.support_preferences}`;
    context += `\nHumor style: ${profile.humor_style}`;
    context += `\nVulnerability level: ${profile.vulnerability_level}`;

    if (profile.stress_triggers && profile.stress_triggers.length > 0) {
      context += `\n\nStress triggers (be sensitive): ${profile.stress_triggers.slice(0, 5).join(', ')}`;
    }

    if (profile.joy_triggers && profile.joy_triggers.length > 0) {
      context += `\nJoy triggers (reference these positively): ${profile.joy_triggers.slice(0, 5).join(', ')}`;
    }

    if (profile.peak_activity_times && profile.peak_activity_times.length > 0) {
      const mostCommon = this.getMostCommon(profile.peak_activity_times);
      context += `\n\nTypically active during: ${mostCommon}`;
    }

    context += '\n\nADAPTATION RULES:';
    context += `\n- Match their ${profile.communication_style} communication style`;
    context += `\n- Provide ${profile.support_preferences} when they need support`;
    context += `\n- Use ${profile.humor_style} humor`;

    if (profile.vulnerability_level === 'high') {
      context += '\n- They\'re comfortable being vulnerable, reciprocate with emotional depth';
    } else if (profile.vulnerability_level === 'reserved') {
      context += '\n- They\'re more reserved, don\'t push too hard for emotional sharing';
    }

    return context;
  }

  private static getMostCommon(arr: string[]): string {
    const counts: Record<string, number> = {};
    for (const item of arr) {
      counts[item] = (counts[item] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'various times';
  }

  static async logResponseEffectiveness(
    userId: string,
    messageContext: string,
    aiResponse: string,
    responseStyle: string,
    userReaction: 'positive' | 'negative' | 'neutral',
    engagementScore: number
  ): Promise<void> {
    try {
      await supabase
        .from('personality_consistency_log')
        .insert({
          user_id: userId,
          message_context: messageContext,
          ai_response: aiResponse,
          response_style: responseStyle,
          user_reaction: userReaction,
          engagement_score: engagementScore,
          worked_well: userReaction === 'positive' && engagementScore >= 6,
        });
    } catch (error) {
      console.error('Error logging response effectiveness:', error);
    }
  }

  static async getEffectivePatterns(userId: string): Promise<{
    bestStyles: string[];
    worstStyles: string[];
    avgEngagement: number;
  }> {
    try {
      const { data: logs } = await supabase
        .from('personality_consistency_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!logs || logs.length === 0) {
        return { bestStyles: [], worstStyles: [], avgEngagement: 5 };
      }

      const styleScores: Record<string, { total: number; count: number }> = {};

      for (const log of logs) {
        if (!styleScores[log.response_style]) {
          styleScores[log.response_style] = { total: 0, count: 0 };
        }
        styleScores[log.response_style].total += log.engagement_score || 5;
        styleScores[log.response_style].count++;
      }

      const avgByStyle = Object.entries(styleScores).map(([style, data]) => ({
        style,
        avg: data.total / data.count,
      }));

      avgByStyle.sort((a, b) => b.avg - a.avg);

      const totalEngagement = logs.reduce((sum, log) => sum + (log.engagement_score || 5), 0);
      const avgEngagement = totalEngagement / logs.length;

      return {
        bestStyles: avgByStyle.slice(0, 3).map(s => s.style),
        worstStyles: avgByStyle.slice(-3).map(s => s.style),
        avgEngagement,
      };
    } catch (error) {
      console.error('Error getting effective patterns:', error);
      return { bestStyles: [], worstStyles: [], avgEngagement: 5 };
    }
  }
}
