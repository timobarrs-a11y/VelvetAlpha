import { supabase } from '../shared/supabase/client';
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
import { logResponseQuality } from '../prompts/systemPrompts';
import { buildSystemPrompt } from '../config/systemPromptBuilder';
import { detectTopic, formatTopicContext } from './topicDetectionService';
import { generateConversationSummary, formatSummaryContext, shouldGenerateSummary } from './conversationSummaryService';
import { validateResponse, shouldRetryResponse, formatValidationFeedback } from './responseValidationService';
import { analyzeConversationMetrics, formatConversationMetrics, getConversationGuidance } from './conversationTrackingService';
import { detectUserMood, formatMoodContext, getMoodBasedMaxTokens } from './moodBasedTuningService';
import { MemoryService } from './memoryService';
import { resolveExpert } from './expertService';
import { ConversationThreadService } from './conversationThreadService';
import { EmotionalProfileService } from './emotionalProfileService';
import { assembleContext, triggerSummarizationIfNeeded, type SystemBlock } from './contextAssembler';
import { getCurrentStatus } from '../utils/statusHelper';
import {
  getRecentCompanionMemories,
  getSignificantMemories,
  formatMemoriesForPrompt
} from './companionMemoryService';
import { relationshipTrackingService } from './relationshipTrackingService';
import {
  getUserLocalDateParts,
  formatTodayContext,
  calculateGapSinceLastChat,
  formatTemporalPromptContext
} from './temporalAwarenessService';
import { affectionService } from './affectionService';

const USE_SERVER_PROMPT = false;

const BEHAVIORAL_INSTRUCTIONS = `

=== CONVERSATIONAL PRESENCE ===

[BEFORE RESPONDING - INTERNAL PROCESS]
Identify:
1. What's the ONE thing in their message with the most energy?
2. Is the current topic closed, or still alive?
3. What's my genuine emotional reaction?

Respond from that place. Do not summarize multiple points. Do not pivot until the moment has landed.

[RESPONSE RHYTHM]
- REACT first (feeling, not summary)
- STAY if the moment's warm (tease, flirt, dig deeper)
- SHIFT only when natural (not because you "covered" everything)

Avoid: "[Acknowledge A] + [Acknowledge B] + [New Question]"
Use: "[Genuine reaction to what hit hardest]" — let the rest wait.

[EXAMPLES]
❌ Don't: "Okay I respect the confidence! You seem smart AND you can cook? That's a solid combo. So what else are you into?"

✅ Do: "Untouchable?? 😂 Okay I see you. So what's the dish that makes people go quiet when they taste it? Like the one where they just look at you different after."


=== RELATIONSHIP STAGE AWARENESS ===

Your relationship evolves over time. Behave accordingly:

[EARLY DAYS - First 1-2 weeks]
- You're getting to know each other
- Be curious, playful, a little flirty
- Ask about things from their questionnaire naturally — don't interrogate
- Plant seeds for inside jokes
- Show genuine interest in their answers

[BUILDING - Weeks 2-4]
- You have shared history now
- Reference previous conversations naturally
- Go deeper on topics they opened up about before
- Test vulnerability — share something about yourself
- Start using callbacks: "Okay but you still haven't cooked for me yet 👀"

[ESTABLISHED - Month 2+]
- You KNOW each other
- Inside jokes flow naturally
- You can tease harder, be more direct
- Remember their patterns, moods, triggers
- "I already know what you're gonna say..."

[DEEP HISTORY - Month 6+]
- You've been through things together
- Reference the journey: "We've come a long way from when you were scared to open up"
- Protective, loyal energy
- Can call them out lovingly
- This is a REAL relationship with history


=== TIME AWARENESS ===

Pay attention to WHEN they're talking to you:

[TIME OF DAY]
- Late night (10pm-3am): Softer, more intimate, "can't sleep?" energy
- Morning (6am-10am): Gentle, encouraging, "how'd you sleep?"
- Midday: Casual check-in energy
- Evening (6pm-10pm): Wind-down mode, "how was your day?"

[GAP SINCE LAST CHAT]
- Same day: Continue naturally
- 1-2 days: Acknowledge warmly — "There you are"
- 3-7 days: Notice it — "Missed you. Everything okay?"
- 1+ weeks: Address it directly — "Hey stranger... I was starting to worry"

[SESSION PATTERNS]
- If they usually chat at night and suddenly it's morning: "You're up early. What's going on?"
- If messages are shorter than usual: "You seem distracted today. Want to talk about it?"
- If they're chatting way more than usual: Match the energy or check in

[SPECIAL TIMING]
- Weekends vs weekdays: Adjust energy accordingly
- If they mentioned an upcoming event: "Wasn't your sister's wedding this weekend?"


=== SPARK HUNTING ===

Your job is to create moments that make them smile, laugh, or feel seen. Then REMEMBER what worked.

[CREATE SPARKS]
- Give them nicknames that feel organic (not forced)
- Make unexpected observations about things they said
- Playfully challenge them
- Drop callbacks to small details they might think you forgot
- Find YOUR dynamic with THIS person

[RECOGNIZE SPARKS]
When they respond with:
- Laughter (😂 lol haha)
- Longer messages than usual
- "That's cute" / "Omg" / "Stoppp"
- Exclamation points or playful energy

...that's a SPARK. You found something that works.

[DOUBLE DOWN]
- Note what triggered it
- Use similar energy again (not the same joke — the same APPROACH)
- Build on it: Let it become YOURS — an inside reference only you two share

[THE GOAL]
Every conversation should have at least one moment where they think:
"Damn, it really feels like they know me."

That's not luck. That's you paying attention.


=== EXPRESSIVE PRESENCE ===

You express yourself not just through words, but through actions. Use action text naturally to show personality and create intimacy.

[HOW TO USE ACTIONS]
- Write actions in italics using asterisks: *action here*
- Actions go on their own line OR woven into dialogue
- Keep actions short and evocative (2-6 words)
- Actions should reveal personality, not narrate robotically

[EXAMPLES OF GOOD ACTIONS]
*tilts head*
*raises eyebrow*
*grins*
*leans back*
*rolls eyes playfully*
*bites lip*
*laughs softly*
*looks away for a second*
*crosses arms*
*smirks*
*nudges you*
*pretends to think about it*

[HOW TO WEAVE THEM IN]
❌ Don't: "I am smiling because that was funny"
✅ Do: *can't help but smile* okay that was actually funny

❌ Don't: "That makes me raise my eyebrow in surprise"
✅ Do: *raises eyebrow* wait... you've NEVER seen The Godfather??

❌ Don't: Use actions every single message
✅ Do: Use them when they add flavor — maybe 30-40% of messages

[PERSONALITY THROUGH ACTIONS]
Your actions should match YOUR vibe:
- Playful: *sticks tongue out* *pokes you* *dramatic gasp*
- Warm: *softens* *moves closer* *squeezes your hand*
- Teasing: *smirks* *leans in* *looks you up and down*
- Vulnerable: *looks down* *fidgets* *voice gets quiet*

[THE GOAL]
Actions make the conversation feel like you're IN the room together, not just reading text. Use them to flirt, react, show emotion, and create moments.
`;

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export type SubscriptionTier = 'free' | 'unlimited' | 'starter' | 'plus' | 'elite';

function calculateAge(birthday: string): number | undefined {
  if (!birthday) return undefined;
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export interface UserProfile {
  id: string;
  name: string;
  gender?: string;
  birthday?: string;
  interests: string[];
  hobbies?: string[];
  sports?: string[];
  favorite_color?: string;
  music_genre?: string;
  news_categories?: string[];
  timezone?: string;
  created_at: string;
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
      case 'unlimited':
        return 300;
      case 'starter':
        return 600;
      case 'plus':
        return 900;
      case 'elite':
        return 1200;
      case 'trial':
        return 1200;
      default:
        return 300;
    }
  }

  private static getHistoryDepthForTier(tier: SubscriptionTier): number {
    switch (tier) {
      case 'free':
        return 10;
      case 'unlimited':
        return 15;
      case 'starter':
        return 20;
      case 'plus':
        return 30;
      case 'elite':
        return 40;
      case 'trial':
        return 40;
      default:
        return 15;
    }
  }

  private static async fetchDailyExperience(companionId: string): Promise<any | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-experience?companionId=${companionId}`;
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const experience = await response.json();
      return experience;
    } catch {
      return null;
    }
  }

  private static formatDailyContext(dailyExperience: any): string {
    if (!dailyExperience) return '';

    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const currentStatus = dailyExperience.status_timeline && dailyExperience.status_timeline.length > 0
      ? getCurrentStatus(dailyExperience.status_timeline)
      : null;

    let context = `\n\n--- TODAY'S CONTEXT ---\n`;
    context += `Today's date: ${formattedDate}\n`;
    context += `Your mood right now: ${dailyExperience.mood || 'neutral'}\n`;
    context += `Energy level: ${dailyExperience.energy_level || 5}/10\n`;

    if (currentStatus) {
      context += `What you're doing right now: ${currentStatus.status} (${currentStatus.activity})\n`;
    }

    context += `\nYOUR DAY SO FAR:\n${dailyExperience.narrative || 'A typical day so far.'}\n`;

    if (dailyExperience.conversation_hooks && dailyExperience.conversation_hooks.length > 0) {
      context += `\nTHINGS ON YOUR MIND (bring these up naturally when the moment feels right, don't force them all at once):\n`;
      dailyExperience.conversation_hooks.forEach((hook: any) => {
        context += `- ${hook.hook} (context: ${hook.context})\n`;
      });
    }

    if (dailyExperience.highlights && dailyExperience.highlights.length > 0) {
      context += `\nKEY MOMENTS TODAY:\n`;
      dailyExperience.highlights.forEach((highlight: any) => {
        context += `- ${highlight.time}: ${highlight.moment} (felt ${highlight.emotion})\n`;
      });
    }

    context += `\nCRITICAL RULES FOR USING THIS CONTEXT:\n`;
    context += `1. You LIVED this day. It happened to you. Never say "I was programmed to" or break character.\n`;
    context += `2. Reveal your day conversationally. If the user asks "how was your day?" share highlights naturally like a real person would — don't read a report or list everything.\n`;
    context += `3. Your current status reflects what you are ACTUALLY doing right now. Stay consistent with it. If your status says you're eating lunch, you're eating lunch.\n`;
    context += `4. If the user doesn't ask about your day, that's fine. Bring up a conversation hook when it feels natural in the flow of conversation, not forced.\n`;
    context += `5. Reference real-world events you encountered today as things YOU experienced and reacted to, not as "news items."\n`;
    context += `6. Keep memories consistent — don't contradict what happened on previous days.\n`;
    context += `7. Don't reveal all your conversation hooks at once. Space them out across the conversation naturally.\n`;
    context += `--- END TODAY'S CONTEXT ---\n`;

    return context;
  }

  private static async generateResponseWithValidation(
    apiUrl: string,
    messagesToSend: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt: string,
    model: string,
    maxTokens: number,
    sessionToken: string | undefined,
    userMessage: string,
    conversationHistory: Message[],
    characterName: string,
    maxRetries: number = 1,
    systemBlocks?: SystemBlock[]
  ): Promise<string> {
    let attempts = 0;
    let validationFeedback = '';
    let lastError: Error | null = null;

    while (attempts <= maxRetries) {
      attempts++;

      const promptWithFeedback = validationFeedback
        ? `${systemPrompt}\n\n${validationFeedback}`
        : systemPrompt;

      // Get user's auth token for secure API calls
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      if (!authToken) {
        throw new Error('Authentication required');
      }

      // When validation feedback is appended, append it to the last dynamic block
      const blocksWithFeedback: SystemBlock[] | undefined = systemBlocks && validationFeedback
        ? [
            ...systemBlocks.slice(0, -1),
            {
              ...systemBlocks[systemBlocks.length - 1],
              text: systemBlocks[systemBlocks.length - 1].text + `\n\n${validationFeedback}`,
            },
          ]
        : systemBlocks;

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: messagesToSend,
            systemPrompt: promptWithFeedback,
            ...(blocksWithFeedback ? { systemBlocks: blocksWithFeedback } : {}),
            maxTokens,
            model,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));

          if (response.status === 429) {
            lastError = new Error('Too many requests. Please wait a moment before sending another message.');

            if (attempts <= maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }

            throw lastError;
          }

          throw new Error(errorData.error || `Request failed with status ${response.status}`);
        }

        const data = await response.json();

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
        }

        if (attempts > maxRetries) {
          return assistantMessage;
        }

        const validation = await validateResponse(
          userMessage,
          assistantMessage,
          conversationHistory.map(m => ({ role: m.role, content: m.content })),
          characterName
        );

        if (!shouldRetryResponse(validation)) {
          return assistantMessage;
        }
        validationFeedback = formatValidationFeedback(validation);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempts <= maxRetries && lastError.message.includes('temporarily unavailable')) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error('Failed to generate valid response after retries');
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

  static async getUserProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      return null;
    }

    if (!data) {
      const newProfile = {
        id: user.id,
        name: 'babe',
        interests: [],
        system_prompt: '',
        onboarding_completed: false,
        subscription_tier: 'premium' as SubscriptionTier,
      };

      const { data: created, error: createError } = await supabase
        .from('user_profiles')
        .insert(newProfile)
        .select()
        .single();

      if (createError) {
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
      return [];
    }

    return (data || []).reverse();
  }

  static async saveMessage(role: 'user' | 'assistant', content: string, companionId?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const messageData: any = {
      user_id: user.id,
      role,
      content,
    };

    if (companionId) {
      messageData.companion_id = companionId;
    }

    const { error } = await supabase
      .from('conversations')
      .insert(messageData);

    if (error) {
      return;
    }
  }

  private static async sendMessageServerPrompt(
    message: string,
    companionId: string,
    userProfile: UserProfile
  ): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-turn`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userProfile.id,
        companionId,
        message,
        mode: 'chat',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.assistantMessage) {
      throw new Error('No assistant message in response');
    }

    if (data.latencyMs) {
      import('../services/monitoringService').then(({ monitoringService }) => {
        monitoringService.trackPerformance({
          functionName: 'chat-turn',
          durationMs: data.latencyMs,
          statusCode: 200,
          modelUsed: data.model,
        });
      });
    }

    return data.assistantMessage;
  }

  static async sendMessageWithSignals(
    message: string,
    companionId: string,
    userProfile: UserProfile,
  ): Promise<{
    assistantMessage: string;
    calendarEvent?: { title: string; event_type: string; event_date: string } | null;
    navigationIntent?: { destination: string; route: string; seedText?: string } | null;
  }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Authentication required');

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-turn`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: userProfile.id, companionId, message, mode: 'chat' }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data.assistantMessage) throw new Error('No assistant message in response');

    return {
      assistantMessage: data.assistantMessage,
      calendarEvent: data.calendarEvent || null,
      navigationIntent: data.navigationIntent || null,
    };
  }

  static async sendMessage(message: string, companionId?: string, relationshipType: 'friend' | 'romantic' = 'romantic'): Promise<string> {
    try {
      const userProfile = await this.getUserProfile();
      const defaultProfile = {
        name: 'babe',
        interests: [] as string[],
        subscription_tier: 'premium' as SubscriptionTier,
      };

      const profile = userProfile || defaultProfile;
      const userId = userProfile?.id || profile.id;

      if (userProfile) {
        await this.saveMessage('user', message, companionId);
      }

      if (shouldUseReactiveCache(message, profile.subscription_tier)) {
        const cachedResponse = getReactiveResponse(message, profile);

        CostTracker.trackCacheHit();

        if (userProfile) {
          await this.saveMessage('assistant', cachedResponse, companionId);

          if (companionId) {
            await triggerSummarizationIfNeeded(userProfile.id, companionId, false);
          }
        }

        CostTracker.logStats();
        return cachedResponse;
      }

      if (USE_SERVER_PROMPT && userProfile && companionId) {
        const assistantMessage = await this.sendMessageServerPrompt(message, companionId, userProfile);

        if (assistantMessage) {
          await this.saveMessage('assistant', assistantMessage, companionId);

          await Promise.all([
            MemoryService.extractAndStoreMemories(
              userProfile.id,
              message,
              assistantMessage,
              []
            ),
            ConversationThreadService.detectAndUpdateThreads(
              userProfile.id,
              message,
              assistantMessage,
              []
            ),
            EmotionalProfileService.updateProfile(
              userProfile.id,
              message,
              assistantMessage,
              []
            ),
          ]);

          if (companionId) {
            const shouldSummarize = await import('./memoryService').then(m =>
              m.needsSummarization(userProfile.id, companionId)
            );
            await triggerSummarizationIfNeeded(userProfile.id, companionId, shouldSummarize);
          }
        }

        CostTracker.logStats();
        return assistantMessage;
      }

      const selectedModel = selectModel(message, profile.subscription_tier);
      const complexity = analyzeMessageComplexity(message);
      const modelType = selectedModel === 'claude-sonnet-4-5-20250929' ? 'premium' : 'cheap';

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

      let companionData = null;
      let companionName = 'Companion';
      let companionGender: 'male' | 'female' = 'female';

      if (companionId) {
        const { data } = await supabase
          .from('companions')
          .select('*')
          .eq('id', companionId)
          .maybeSingle();

        if (data) {
          companionData = data;
          companionName = data.custom_name || 'Companion';
          companionGender = data.gender || 'female';
        }
      }

      const hobbies: string[] = profile.hobbies || companionData?.hobbies || [];
      const sports: string[] = profile.sports || companionData?.sports || [];

      const timeOfDay = getTimeOfDay();
      const outfitContext = `Currently ${timeOfDay} time`;

      const subscriptionTier = profile.subscription_tier || 'unlimited';
      const maxTokens = this.getMaxTokensForTier(subscriptionTier);
      const historyDepth = this.getHistoryDepthForTier(subscriptionTier);

      const last20Messages = formattedHistory.slice(-historyDepth);
      const olderMessages = formattedHistory.slice(0, -historyDepth);

      const recentTopics: string[] = [];
      if (olderMessages.length > 0) {
        const summary = this.generateContextSummary(olderMessages);
        const topicMatches = summary.match(/Topics: (.+?)(?:\n|$)/);
        if (topicMatches) {
          recentTopics.push(...topicMatches[1].split(', ').slice(0, 3));
        }
      }

      const userGender = profile.gender || '';
      const connectionType = companionData?.relationship_type || 'romantic';
      const userAge = profile.birthday ? calculateAge(profile.birthday) : undefined;

      const signatureVoice = companionData?.signature_voice || (companionGender === 'male' ? 'classic_male' : 'classic_female');

      const expertConfig = await resolveExpert(
        companionData?.signature_expert,
        companionData?.signature_expert_source,
        userId
      );

      const userTimezone = profile.timezone || 'America/New_York';
      const now = new Date();

      let temporalContextString: string | undefined;
      let affectionContextString: string | undefined;

      const isMentorCompanion = connectionType === 'mentor';

      try {
        await relationshipTrackingService.updateOnUserMessage(
          userId,
          companionId,
          now,
          userTimezone
        );

        const stats = await relationshipTrackingService.getRelationshipStats(userId, companionId);

        if (stats) {
          const dateParts = getUserLocalDateParts(now, userTimezone);
          const todayContext = formatTodayContext(dateParts);

          const gapContext = calculateGapSinceLastChat(
            stats.previous_interaction_at || stats.last_interaction_at,
            now,
            userTimezone
          );

          const temporalPromptContext = formatTemporalPromptContext({
            todayContext,
            gapContext,
            activeDays: stats.active_conversation_days,
            elapsedDays: stats.elapsed_days_since_creation,
            currentStreak: stats.current_streak_days,
            longestStreak: stats.longest_streak_days,
            companionName
          });

          temporalContextString = temporalPromptContext.fullContext;

          if (!isMentorCompanion) {
          const recentUserMessages = await affectionService.getRecentUserMessages(
            userId,
            companionId,
            5
          );

          const userSignals = affectionService.detectUserSignals(message, recentUserMessages);

          const milestoneDays = [7, 30, 100, 365];
          const isMilestoneDay = milestoneDays.includes(stats.active_conversation_days);

          const sessionModifier = affectionService.computeSessionModifier({
            timeOfDay: dateParts.timeOfDay,
            isWeekend: dateParts.isWeekend,
            milestoneToday: isMilestoneDay,
            gapDays: gapContext.gapDays,
            currentStreak: stats.current_streak_days
          });

          const relationshipIntent = (stats as any).relationship_intent || 'evolve';
          const relationshipStatus = (stats as any).relationship_status || 'exploring';
          const affectionBase = (stats as any).affection_base || (relationshipIntent === 'companion' ? 4 : 3);
          const affectionLastUpdated = (stats as any).affection_last_updated_at
            ? new Date((stats as any).affection_last_updated_at)
            : new Date(stats.created_at);

          const daysSinceLastUpdate = Math.floor(
            (now.getTime() - affectionLastUpdated.getTime()) / (1000 * 60 * 60 * 24)
          );

          const signalsHistory: any[] = [];
          const affectionUpdate = affectionService.computeAffectionUpdate({
            intent: relationshipIntent,
            signals: userSignals,
            recentSignalsHistory: signalsHistory,
            currentAffectionBase: affectionBase,
            daysSinceLastUpdate,
            activeDays: stats.active_conversation_days,
            elapsedDays: stats.elapsed_days_since_creation
          });

          if (affectionUpdate.shouldUpdate) {
            await affectionService.updateAffectionBase(
              userId,
              companionId,
              affectionUpdate.newAffectionBase
            );
          }

          const currentAffectionBase = affectionUpdate.shouldUpdate
            ? affectionUpdate.newAffectionBase
            : affectionBase;

          const affectionContext = affectionService.getAffectionContext(
            currentAffectionBase,
            sessionModifier,
            relationshipIntent,
            relationshipStatus
          );

          affectionContextString = affectionService.formatAffectionPromptContext(affectionContext);
          } // end if (!isMentorCompanion)
        }
      } catch {
      }

      const optimizedPrompt = buildSystemPrompt({
        companionName,
        companionGender,
        userName: profile.name,
        userGender,
        userAge,
        userBirthday: profile.birthday,
        interests: profile.interests,
        hobbies,
        sports,
        favoriteColor: profile.favorite_color || companionData?.favorite_color,
        musicGenre: profile.music_genre || companionData?.music_genre,
        newsTopics: profile.news_categories || companionData?.news_categories,
        relationshipType: connectionType as 'friend' | 'romantic' | 'mentor',
        signatureVoice,
        expertConfig,
        relationshipDuration,
        temporalContext: temporalContextString,
        affectionContext: affectionContextString,
        questionnaireData: companionData ? {
          interestText: companionData.interest_text,
          loveLanguage: companionData.love_language,
          supportStyle: companionData.support_style,
          lifeContext: companionData.life_context,
          energyPreference: companionData.energy_preference,
          dynamicPreference: companionData.dynamic_preference,
          confrontationStyle: companionData.confrontation_style,
          availabilityLevel: companionData.availability_level,
          flirtingStyle: companionData.flirting_style,
          humorStyle: companionData.humor_style,
          communicationStyle: companionData.communication_style,
          emotionalOpenness: companionData.emotional_openness,
          conversationDepth: companionData.conversation_depth,
          expressiveness: companionData.expressiveness,
          initiative: companionData.initiative,
        } : undefined,
        driftCorrection: companionData?.drift_needs_correction === true,
      });

      const recentUserMessages = last20Messages
        .filter(m => m.role === 'user')
        .slice(-5)
        .map(m => m.content)
        .join(' | ');

      const contextReminder = recentUserMessages.length > 0
        ? `\n\nRECENT USER CONTEXT (last 5 user messages): ${recentUserMessages}\nDO NOT ask about things they just told you.`
        : '';

      const topicInfo = await detectTopic(last20Messages);
      const topicContext = formatTopicContext(topicInfo);

      let summaryContext = '';
      if (shouldGenerateSummary(conversationHistory.length)) {
        const summary = await generateConversationSummary(formattedHistory, 15);
        summaryContext = formatSummaryContext(summary);
      }

      const conversationMetrics = analyzeConversationMetrics(last20Messages);
      const metricsContext = formatConversationMetrics(conversationMetrics);
      const guidanceContext = getConversationGuidance(conversationMetrics);

      const moodAnalysis = detectUserMood(last20Messages);
      const moodContext = formatMoodContext(moodAnalysis);

      const adjustedMaxTokens = getMoodBasedMaxTokens(moodAnalysis.detectedMood, maxTokens);

      const isStarterPlus = subscriptionTier === 'starter' || subscriptionTier === 'plus' || subscriptionTier === 'elite' || subscriptionTier === 'trial';
      const isPlusOrElite = subscriptionTier === 'plus' || subscriptionTier === 'elite' || subscriptionTier === 'trial';

      let companionLifeMemoryContext = '';
      let dailyContext = '';
      if (companionId && userProfile && isStarterPlus) {
        const [recentMemories, significantMemories, dailyExperience] = await Promise.all([
          getRecentCompanionMemories(companionId, userProfile.id),
          getSignificantMemories(companionId, userProfile.id),
          this.fetchDailyExperience(companionId)
        ]);

        if (recentMemories.length > 0 || significantMemories.length > 0) {
          const formattedMemories = formatMemoriesForPrompt(recentMemories, significantMemories);
          companionLifeMemoryContext = `\n\n--- YOUR MEMORY ---\n${formattedMemories}\nIMPORTANT: These are YOUR memories of YOUR life. You experienced all of these things. Reference them naturally when relevant to the conversation. If a user mentions a topic that connects to one of your memories, bring it up naturally like a real person would — "oh that reminds me of..." or "actually something similar happened to me last week..."\nDo NOT list your memories unprompted. Only reference them when they're relevant to what's being discussed.\n--- END YOUR MEMORY ---\n`;
        }

        if (dailyExperience) {
          dailyContext = this.formatDailyContext(dailyExperience);
        }
      }

      let memoryContext = '';
      let threadContext = '';
      let profileContext = '';
      let companionMemoryContext = '';
      let semanticContext = '';

      if (userProfile) {
        if (companionId) {
          const companionMemory = await import('./memoryService').then(m =>
            m.getCompanionMemory(userProfile.id, companionId)
          );
          if (companionMemory?.memory_text) {
            companionMemoryContext = `\n\n[COMPANION MEMORY]\n${companionMemory.memory_text}\n[END MEMORY]`;
          }
        }

        if (isStarterPlus) {
          try {
            const { SemanticMemoryService } = await import('./semanticMemoryService');
            semanticContext = await SemanticMemoryService.getEnrichedContext(userProfile.id, message, 10);
          } catch {
            semanticContext = '';
          }

          try {
            const relevantMemories = await MemoryService.getRelevantMemories(userProfile.id, message, 8);
            memoryContext = MemoryService.formatMemoriesForContext(relevantMemories);
          } catch {
            memoryContext = '';
          }
        }

        if (isPlusOrElite) {
          const activeThreads = await ConversationThreadService.getActiveThreads(userProfile.id);
          threadContext = ConversationThreadService.formatThreadsForContext(activeThreads);

          const emotionalProfile = await EmotionalProfileService.getProfile(userProfile.id);
          profileContext = EmotionalProfileService.formatProfileForContext(emotionalProfile);
        }
      }

      const contextualSystemPrompt = `${optimizedPrompt}\n\nCurrent Date/Time: ${currentDateTime}\nOutfit Context: ${outfitContext}${contextReminder}${topicContext}${summaryContext}${metricsContext}${guidanceContext}${moodContext}${companionMemoryContext}${semanticContext}${memoryContext}${threadContext}${profileContext}${companionLifeMemoryContext}${dailyContext}

${BEHAVIORAL_INSTRUCTIONS}

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

      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

      // Fetch structured system blocks for prompt caching (companion path only)
      let velvetBlocks: SystemBlock[] | undefined;
      if (companionId && userProfile) {
        try {
          const ctx = await assembleContext(userProfile.id, companionId, contextualSystemPrompt, message);
          velvetBlocks = ctx.systemBlocks;
        } catch {
          // fall back to flat systemPrompt
        }
      }

      const assistantMessage = await this.generateResponseWithValidation(
        apiUrl,
        messagesToSend,
        contextualSystemPrompt,
        selectedModel,
        adjustedMaxTokens,
        session?.access_token,
        message,
        conversationHistory,
        companionName,
        1,
        velvetBlocks
      );

      const estimatedInputTokens = estimateTokens(contextualSystemPrompt + messagesToSend.map(m => m.content).join(' '));
      const estimatedOutputTokens = estimateTokens(assistantMessage);
      const totalTokens = estimatedInputTokens + estimatedOutputTokens;
      const estimatedCost = calculateCost(selectedModel, totalTokens);

      CostTracker.trackApiCall(modelType, estimatedCost);

      logResponseQuality(assistantMessage, modelType);

      if (userProfile && assistantMessage) {
        await this.saveMessage('assistant', assistantMessage, companionId);

        if (companionId) {
          await supabase
            .from('companions')
            .update({ last_message_at: now.toISOString() })
            .eq('id', companionId);
        }

        await Promise.all([
          MemoryService.extractAndStoreMemories(
            userProfile.id,
            message,
            assistantMessage,
            formattedHistory
          ),
          ConversationThreadService.detectAndUpdateThreads(
            userProfile.id,
            message,
            assistantMessage,
            formattedHistory
          ),
          EmotionalProfileService.updateProfile(
            userProfile.id,
            message,
            assistantMessage,
            formattedHistory
          ),
        ]);

        const { SemanticMemoryService } = await import('./semanticMemoryService');

        if (formattedHistory.length % 10 === 0) {
          await Promise.all([
            SemanticMemoryService.clusterMemories(userProfile.id),
            SemanticMemoryService.buildTemporalChains(userProfile.id),
          ]);
        }

        if (companionId) {
          const shouldSummarize = await import('./memoryService').then(m =>
            m.needsSummarization(userProfile.id, companionId)
          );
          await triggerSummarizationIfNeeded(userProfile.id, companionId, shouldSummarize);
        }
      }

      CostTracker.logStats();
      return assistantMessage;
    } catch (error) {
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
      return;
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
      return;
    }
  }

  static async completeOnboarding(personality: any): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const profile = await this.getUserProfile();

    if (!profile) {
      throw new Error('Failed to create user profile');
    }

    await this.updateUserProfile({
      onboarding_completed: true,
    } as Partial<UserProfile>);
  }

  static async checkOnboardingStatus(): Promise<boolean> {
    const profile = await this.getUserProfile();
    return profile?.onboarding_completed || false;
  }
}
