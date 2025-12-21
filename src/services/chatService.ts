import { supabase } from './supabase';
import { CharacterType, getCharacter } from '../config/characters';
import { getTimeOfDay } from '../utils/imageSelector';
import { shouldUseReactiveCache, getReactiveResponse } from './reactiveCache';
import { CostTracker } from './costTracker';
import {
  selectModel,
  analyzeMessageComplexity,
  getModelDisplayName,
  estimateTokens,
  calculateCost,
  ModelType
} from './modelSelector';
import { getSystemPrompt, logResponseQuality, UserContext } from '../prompts/systemPrompts';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export type SubscriptionTier = 'free' | 'basic' | 'premium';

export interface UserProfile {
  id: string;
  name: string;
  interests: string[];
  personality_settings: {
    availability?: 'always_there' | 'independent';
    dynamic?: 'wants_to_be_led' | 'challenges_them';
    affection?: 'highly_affectionate' | 'subtle_affection';
    communication?: 'overshares' | 'keeps_mystery';
    support?: 'endless_encouragement' | 'real_talk';
    energy?: 'bubbly_high' | 'calm_chill';
    lifestyle?: 'homebody' | 'social_active';
  };
  system_prompt: string;
  created_at: string;
  character_type: CharacterType;
  onboarding_completed: boolean;
  subscription_tier: SubscriptionTier;
}

interface ContextSummary {
  userFacts: string[];
  relationshipMoments: string[];
  topics: string[];
}

export class ChatService {
  private static getMaxTokensForTier(tier: SubscriptionTier): number {
    switch (tier) {
      case 'free':
        return 100;
      case 'basic':
        return 200;
      case 'premium':
        return 500;
      default:
        return 500;
    }
  }

  private static generateContextSummary(messages: Array<{ role: 'user' | 'assistant'; content: string }>): string {
    const summary: ContextSummary = {
      userFacts: [],
      relationshipMoments: [],
      topics: [],
    };

    const factKeywords = ['my name is', 'i am', "i'm", 'i work', 'i study', 'my job', 'i love', 'i like', 'i enjoy', 'my hobby', 'my favorite'];
    const momentKeywords = ['love you', 'miss you', 'thank you', 'appreciate', 'special', 'remember when', 'our first'];
    const topicKeywords = ['about', 'think about', 'talk about', 'discuss', 'tell me'];

    const allText = messages.map(m => m.content.toLowerCase()).join(' ');

    for (const msg of messages) {
      const content = msg.content.toLowerCase();

      if (msg.role === 'user') {
        for (const keyword of factKeywords) {
          if (content.includes(keyword)) {
            const sentence = msg.content.split(/[.!?]/).find(s => s.toLowerCase().includes(keyword));
            if (sentence && sentence.trim().length > 0 && sentence.trim().length < 100) {
              summary.userFacts.push(sentence.trim());
            }
          }
        }
      }

      for (const keyword of momentKeywords) {
        if (content.includes(keyword)) {
          const sentence = msg.content.split(/[.!?]/).find(s => s.toLowerCase().includes(keyword));
          if (sentence && sentence.trim().length > 0 && sentence.trim().length < 100) {
            summary.relationshipMoments.push(sentence.trim());
          }
        }
      }
    }

    const commonTopics = ['work', 'school', 'family', 'friends', 'hobbies', 'sports', 'music', 'movies', 'games', 'travel', 'food', 'fitness'];
    for (const topic of commonTopics) {
      if (allText.includes(topic)) {
        summary.topics.push(topic);
      }
    }

    const dedupedFacts = [...new Set(summary.userFacts)].slice(0, 5);
    const dedupedMoments = [...new Set(summary.relationshipMoments)].slice(0, 3);
    const dedupedTopics = [...new Set(summary.topics)].slice(0, 5);

    let summaryText = '';

    if (dedupedFacts.length > 0) {
      summaryText += `\n\nPrevious conversation facts: ${dedupedFacts.join('; ')}`;
    }

    if (dedupedMoments.length > 0) {
      summaryText += `\n\nKey relationship moments: ${dedupedMoments.join('; ')}`;
    }

    if (dedupedTopics.length > 0) {
      summaryText += `\n\nTopics discussed: ${dedupedTopics.join(', ')}`;
    }

    return summaryText;
  }

  private static async getUserProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    if (!data) {
      const newProfile = {
        id: user.id,
        name: 'babe',
        interests: [],
        personality_settings: {
          availability: 'always_there' as const,
          dynamic: 'challenges_them' as const,
          affection: 'highly_affectionate' as const,
          communication: 'overshares' as const,
          support: 'endless_encouragement' as const,
          energy: 'bubbly_high' as const,
          lifestyle: 'social_active' as const,
        },
        system_prompt: '',
        character_type: 'riley' as CharacterType,
        onboarding_completed: false,
        subscription_tier: 'premium' as SubscriptionTier,
      };

      const { data: created, error: createError } = await supabase
        .from('user_profiles')
        .insert(newProfile)
        .select()
        .single();

      if (createError) {
        console.error('Error creating user profile:', createError);
        return null;
      }

      return created;
    }

    return data;
  }

  static async getConversationHistory(limit: number = 20): Promise<Message[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching conversation history:', error);
      return [];
    }

    return (data || []).reverse();
  }

  static async saveMessage(role: 'user' | 'assistant', content: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        role,
        content,
      });

    if (error) {
      console.error('Error saving message:', error);
    }
  }

  static async sendMessage(message: string, companionId?: string, relationshipType: 'friend' | 'romantic' = 'romantic'): Promise<string> {
    try {
      const userProfile = await this.getUserProfile();
      const defaultProfile = {
        name: 'babe',
        interests: [] as string[],
        personality_settings: {
          availability: 'always_there' as const,
          dynamic: 'challenges_them' as const,
          affection: 'highly_affectionate' as const,
          communication: 'overshares' as const,
          support: 'endless_encouragement' as const,
          energy: 'bubbly_high' as const,
          lifestyle: 'social_active' as const,
        },
        system_prompt: '',
        character_type: 'riley' as CharacterType,
        subscription_tier: 'premium' as SubscriptionTier,
      };

      const profile = userProfile || defaultProfile;

      if (userProfile) {
        await this.saveMessage('user', message);
      }

      if (shouldUseReactiveCache(message)) {
        console.log('✅ REACTIVE CACHE HIT:', message);
        const cachedResponse = getReactiveResponse(message, profile);
        console.log('📦 Cached response:', cachedResponse);
        console.log('💰 Saved ~$0.015 API cost');

        CostTracker.trackCacheHit();

        if (userProfile) {
          await this.saveMessage('assistant', cachedResponse);
        }

        CostTracker.logStats();
        return cachedResponse;
      }

      console.log('❌ CACHE MISS - Making AI API call for:', message);

      const selectedModel = selectModel(message, profile.subscription_tier);
      const complexity = analyzeMessageComplexity(message);

      console.log('\n🤖 AI MODEL SELECTION:');
      console.log('  Message:', message.substring(0, 50) + (message.length > 50 ? '...' : ''));
      console.log('  Complexity:', complexity);
      console.log('  User Tier:', profile.subscription_tier);
      console.log('  Selected Model:', getModelDisplayName(selectedModel));

      const conversationHistory = userProfile ? await this.getConversationHistory(50) : [];

      const formattedHistory = conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      const currentDateTime = new Date().toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        timeZoneName: "short",
      });

      const relationshipDuration = userProfile && userProfile.created_at ?
        Math.floor((Date.now() - new Date(userProfile.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;

      const characterType = profile.character_type || 'riley';
      const character = getCharacter(characterType);
      const timeOfDay = getTimeOfDay();
      const outfitContext = character.outfitContexts[timeOfDay];

      const subscriptionTier = profile.subscription_tier || 'premium';
      const maxTokens = this.getMaxTokensForTier(subscriptionTier);

      const last20Messages = formattedHistory.slice(-20);
      const olderMessages = formattedHistory.slice(0, -20);

      const recentTopics: string[] = [];
      if (olderMessages.length > 0) {
        const summary = this.generateContextSummary(olderMessages);
        const topicMatches = summary.match(/Topics: (.+?)(?:\n|$)/);
        if (topicMatches) {
          recentTopics.push(...topicMatches[1].split(', ').slice(0, 3));
        }
      }

      const userContext: UserContext = {
        name: profile.name,
        interests: profile.interests,
        recentTopics,
        characterName: character.name,
      };

      const modelType = selectedModel.includes('haiku') ? 'cheap' : 'premium';
      const optimizedPrompt = getSystemPrompt(modelType, userContext, subscriptionTier, relationshipType);

      const recentUserMessages = last20Messages
        .filter(m => m.role === 'user')
        .slice(-5)
        .map(m => m.content)
        .join(' | ');

      const contextReminder = recentUserMessages.length > 0
        ? `\n\nRECENT USER CONTEXT (last 5 user messages): ${recentUserMessages}\nDO NOT ask about things they just told you.`
        : '';

      const contextualSystemPrompt = `${optimizedPrompt}\n\nCurrent Date/Time: ${currentDateTime}\nOutfit Context: ${outfitContext}${contextReminder}

CRITICAL MEMORY RULES - READ THIS CAREFULLY:
- NEVER ask a question you already asked in this conversation
- Before asking "what are you doing", "how was your day", "what's up", etc. - CHECK if they already answered
- If they already told you something, reference it instead of asking again
- Example: If they said "I'm at work", don't ask "what are you up to?" - instead say "how's work going?"
- Build on information they've shared, don't reset the conversation
- Remember key facts from this conversation: their mood, their plans, what they're doing, what they told you
- You have access to the last 20 messages in formattedHistory - USE THEM
- If you genuinely can't remember something from earlier, acknowledge it naturally: "wait did you tell me this already? sorry babe my brain is scattered today lol"
- NEVER repeat questions within the same conversation session

IMPORTANT: Keep your response under ${maxTokens} tokens.`;

      console.log('\n📝 PROMPT INFO:');
      console.log('  Prompt type:', modelType.toUpperCase());
      console.log('  Prompt length:', contextualSystemPrompt.length, 'chars');
      console.log('  Est. tokens:', Math.ceil(contextualSystemPrompt.length / 4));

      console.log('\n🧠 CONVERSATION CONTEXT DEBUG:');
      console.log('Total history messages:', conversationHistory.length);
      console.log('Last 5 user messages:', recentUserMessages);
      console.log('System prompt length:', contextualSystemPrompt.length, 'chars');

      const alternatingMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      for (const msg of last20Messages) {
        if (alternatingMessages.length === 0 || alternatingMessages[alternatingMessages.length - 1].role !== msg.role) {
          alternatingMessages.push(msg);
        }
      }

      if (alternatingMessages.length > 0 && alternatingMessages[alternatingMessages.length - 1].role === 'user') {
        alternatingMessages.pop();
      }

const messagesToSend = [
  ...alternatingMessages,
  {
    role: 'user' as const,
    content: message,
  },
].filter(msg => msg.content && msg.content.trim().length > 0);

console.log('Calling chat edge function...');
console.log('System prompt length:', contextualSystemPrompt.length);
console.log('Number of messages (filtered):', messagesToSend.length);
console.log('Messages being sent to AI:', messagesToSend.length);

      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesToSend,
          systemPrompt: contextualSystemPrompt,
          apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
          maxTokens,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();

      console.log('\n🔍 RAW API RESPONSE DEBUG:');
      console.log('Full response:', JSON.stringify(data, null, 2));
      console.log('Response keys:', Object.keys(data));
      console.log('Has content?', 'content' in data);
      console.log('Has message?', 'message' in data);
      console.log('Has text?', 'text' in data);
      console.log('Has response?', 'response' in data);
      console.log('data.content:', data.content);
      console.log('data.message:', data.message);
      console.log('data.text:', data.text);
      console.log('data.response:', data.response);

      let assistantMessage = '';

      if (data.content && Array.isArray(data.content) && data.content.length > 0) {
        const firstContent = data.content[0];
        if (firstContent && firstContent.type === 'text' && typeof firstContent.text === 'string') {
          assistantMessage = firstContent.text;
        }
      } else if (typeof data.message === 'string') {
        assistantMessage = data.message;
      } else if (typeof data.text === 'string') {
        assistantMessage = data.text;
      } else if (typeof data.response === 'string') {
        assistantMessage = data.response;
      } else if (typeof data === 'string') {
        assistantMessage = data;
      }

      console.log('\n✅ EXTRACTED MESSAGE:');
      console.log('Message:', assistantMessage);
      console.log('Length:', assistantMessage.length);
      console.log('Type:', typeof assistantMessage);

      const estimatedInputTokens = estimateTokens(contextualSystemPrompt + messagesToSend.map(m => m.content).join(' '));
      const estimatedOutputTokens = estimateTokens(assistantMessage);
      const totalTokens = estimatedInputTokens + estimatedOutputTokens;
      const estimatedCost = calculateCost(selectedModel, totalTokens);

      CostTracker.trackApiCall(modelType, estimatedCost);

      console.log('\n💰 COST TRACKING:');
      console.log('  Model Used:', getModelDisplayName(selectedModel));
      console.log('  Est. Input Tokens:', estimatedInputTokens);
      console.log('  Est. Output Tokens:', estimatedOutputTokens);
      console.log('  Total Tokens:', totalTokens);
      console.log('  Est. Cost: $', estimatedCost.toFixed(4));

      logResponseQuality(assistantMessage, modelType);

      if (userProfile && assistantMessage) {
        await this.saveMessage('assistant', assistantMessage);
      }

      CostTracker.logStats();
      return assistantMessage;
    } catch (error) {
      console.error('Error in sendMessage:', error);
      if (error instanceof Error) {
        throw new Error(`Chat error: ${error.message}`);
      }
      throw new Error('An unexpected error occurred while sending your message');
    }
  }

  static async clearConversationHistory(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing conversation history:', error);
    }
  }

  static async updateUserProfile(updates: Partial<UserProfile>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating user profile:', error);
    }
  }

  static async completeOnboarding(characterType: CharacterType, personality: any): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const profile = await this.getUserProfile();

    if (!profile) {
      throw new Error('Failed to create user profile');
    }

    await this.updateUserProfile({
      character_type: characterType,
      personality_settings: personality,
      onboarding_completed: true,
    } as Partial<UserProfile>);
  }

  static async checkOnboardingStatus(): Promise<boolean> {
    const profile = await this.getUserProfile();
    return profile?.onboarding_completed || false;
  }
}
