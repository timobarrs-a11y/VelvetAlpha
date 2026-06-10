import { supabase } from '../shared/supabase/client';

interface Message {
  role: string;
  content: string;
  created_at?: string;
}

export interface AIAnalysisResult {
  topics: Array<{ name: string; relevance: number; category: string }>;
  sentiment: {
    overall: number;
    trajectory: 'improving' | 'stable' | 'declining';
    emotions: string[];
  };
  goals: Array<{ goal: string; mentioned_at: string; status: 'active' | 'completed' | 'abandoned'; progress?: number }>;
  facts: Array<{ fact: string; category: string; confidence: number }>;
  relationshipHealth: {
    score: number;
    factors: {
      communication: number;
      emotional_support: number;
      engagement: number;
      consistency: number;
    };
    insights: string[];
  };
  personalizedInsights: string[];
  communicationPatterns: {
    responseTime: string;
    conversationInitiator: 'user' | 'companion' | 'balanced';
    topicDepth: 'shallow' | 'moderate' | 'deep';
    vulnerabilityLevel: 'low' | 'medium' | 'high';
  };
}

function getFallbackAnalysis(): AIAnalysisResult {
  return {
    topics: [{ name: 'general', relevance: 0.5, category: 'daily_life' }],
    sentiment: { overall: 0, trajectory: 'stable', emotions: [] },
    goals: [],
    facts: [],
    relationshipHealth: {
      score: 50,
      factors: { communication: 50, emotional_support: 50, engagement: 50, consistency: 50 },
      insights: ['Keep chatting to build your relationship health score'],
    },
    personalizedInsights: ['Continue having conversations to generate insights'],
    communicationPatterns: {
      responseTime: 'moderate',
      conversationInitiator: 'balanced',
      topicDepth: 'moderate',
      vulnerabilityLevel: 'medium',
    },
  };
}

export async function analyzeConversationWithAI(
  messages: Message[],
  companionId: string
): Promise<AIAnalysisResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return getFallbackAnalysis();

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-conversation`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, companionId }),
    });

    if (!response.ok) {
      console.error('analyze-conversation edge function error:', response.status);
      return getFallbackAnalysis();
    }

    const analysis: AIAnalysisResult = await response.json();
    return analysis;
  } catch (error) {
    console.error('Error analyzing conversation with AI:', error);
    return getFallbackAnalysis();
  }
}

export async function processEnhancedInsights(
  conversationId: string,
  userId: string,
  companionId: string,
  messages: Message[]
) {
  try {
    const analysis = await analyzeConversationWithAI(messages, companionId);

    const topicsArray = analysis.topics.map(t => t.name);
    const factsArray = analysis.facts.filter(f => f.confidence > 0.5).map(f => f.fact);
    const uniqueFacts = [...new Set(factsArray)];

    const { error } = await supabase
      .from('conversation_insights')
      .upsert(
        {
          conversation_id: conversationId,
          user_id: userId,
          companion_id: companionId,
          topics: topicsArray,
          sentiment_score: analysis.sentiment.overall,
          facts_extracted: uniqueFacts,
          conversation_date: new Date().toISOString(),
          message_count: messages.length,
          ai_analysis: analysis as unknown as Record<string, unknown>,
        },
        { onConflict: 'conversation_id,user_id' }
      );

    if (error) {
      console.error('Error storing conversation insights:', error);
    }

    await updateUserInsightsSummary(userId, companionId, analysis, messages.length);
  } catch (error) {
    console.error('Error processing enhanced insights:', error);
  }
}

async function updateUserInsightsSummary(
  userId: string,
  companionId: string,
  analysis: AIAnalysisResult,
  messageCount: number
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];

  const { data: existingInsights } = await supabase
    .from('user_insights')
    .select('*')
    .eq('user_id', userId)
    .eq('companion_id', companionId)
    .eq('period_start', startDateStr)
    .maybeSingle();

  const topTopics = analysis.topics
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5)
    .map(t => ({ topic: t.name, count: Math.round(t.relevance * 10) }));

  const sentimentEntry = {
    date: new Date().toISOString(),
    score: analysis.sentiment.overall,
    trajectory: analysis.sentiment.trajectory,
  };

  const factsLearned = analysis.facts
    .filter(f => f.confidence > 0.6)
    .map(f => ({ fact: f.fact, category: f.category }));

  const goalsData = analysis.goals.map(g => ({
    goal: g.goal,
    status: g.status,
    progress: g.progress ?? 0,
  }));

  if (existingInsights) {
    const prevSentiment: typeof sentimentEntry[] = existingInsights.sentiment_trend ?? [];
    const updatedSentiment = [...prevSentiment, sentimentEntry].slice(-30);

    const prevFacts: typeof factsLearned = existingInsights.facts_learned ?? [];
    const allFacts = [...prevFacts, ...factsLearned];
    const uniqueFacts = allFacts.filter(
      (f, i) => allFacts.findIndex(x => x.fact === f.fact) === i
    );

    await supabase
      .from('user_insights')
      .update({
        total_conversations: (existingInsights.total_conversations ?? 0) + 1,
        total_messages: (existingInsights.total_messages ?? 0) + messageCount,
        top_topics: topTopics,
        sentiment_trend: updatedSentiment,
        facts_learned: uniqueFacts.slice(0, 30),
        goals_mentioned: goalsData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingInsights.id);
  } else {
    await supabase
      .from('user_insights')
      .insert({
        user_id: userId,
        companion_id: companionId,
        period_start: startDateStr,
        period_end: endDate,
        total_conversations: 1,
        total_messages: messageCount,
        avg_conversation_length: messageCount,
        top_topics: topTopics,
        sentiment_trend: [sentimentEntry],
        facts_learned: factsLearned,
        goals_mentioned: goalsData,
      });
  }
}

export async function getRelationshipHealthScore(
  userId: string,
  companionId: string
): Promise<{
  score: number;
  factors: {
    communication: number;
    emotional_support: number;
    engagement: number;
    consistency: number;
  };
  insights: string[];
  trend: 'improving' | 'stable' | 'declining';
}> {
  try {
    const { data: recentInsights } = await supabase
      .from('conversation_insights')
      .select('ai_analysis, sentiment_score, conversation_date')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .order('conversation_date', { ascending: false })
      .limit(10);

    if (!recentInsights || recentInsights.length === 0) {
      return {
        score: 0,
        factors: { communication: 0, emotional_support: 0, engagement: 0, consistency: 0 },
        insights: ['Start chatting to build your relationship health score'],
        trend: 'stable',
      };
    }

    const withAI = recentInsights.filter(r => r.ai_analysis);
    if (withAI.length > 0) {
      const latest = withAI[0].ai_analysis as unknown as AIAnalysisResult;
      const scores = withAI.map(r => (r.ai_analysis as unknown as AIAnalysisResult).relationshipHealth?.score ?? 50);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const trend = scores.length >= 2
        ? scores[0] > scores[scores.length - 1] ? 'improving' : scores[0] < scores[scores.length - 1] ? 'declining' : 'stable'
        : 'stable';

      return {
        score: Math.round(avg),
        factors: latest.relationshipHealth?.factors ?? { communication: 50, emotional_support: 50, engagement: 50, consistency: 50 },
        insights: latest.relationshipHealth?.insights ?? [],
        trend,
      };
    }

    const avgSentiment = recentInsights.reduce((sum, r) => sum + (r.sentiment_score ?? 0), 0) / recentInsights.length;
    const score = Math.round(50 + avgSentiment * 50);

    return {
      score,
      factors: { communication: score, emotional_support: score, engagement: score, consistency: score },
      insights: ['Building your relationship health score...'],
      trend: 'stable',
    };
  } catch (error) {
    console.error('Error calculating relationship health:', error);
    return {
      score: 50,
      factors: { communication: 50, emotional_support: 50, engagement: 50, consistency: 50 },
      insights: ['Unable to calculate relationship health at this time'],
      trend: 'stable',
    };
  }
}

export async function getGoalsData(
  userId: string,
  companionId: string
): Promise<Array<{ goal: string; status: 'active' | 'completed' | 'abandoned'; progress: number }>> {
  try {
    const { data: recentInsights } = await supabase
      .from('conversation_insights')
      .select('ai_analysis')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .not('ai_analysis', 'is', null)
      .order('conversation_date', { ascending: false })
      .limit(10);

    if (!recentInsights || recentInsights.length === 0) return [];

    const goalMap = new Map<string, { status: 'active' | 'completed' | 'abandoned'; progress: number }>();

    for (const row of recentInsights) {
      const ai = row.ai_analysis as unknown as AIAnalysisResult;
      if (!ai?.goals) continue;
      for (const g of ai.goals) {
        if (!goalMap.has(g.goal)) {
          goalMap.set(g.goal, { status: g.status, progress: g.progress ?? 0 });
        }
      }
    }

    return Array.from(goalMap.entries()).map(([goal, meta]) => ({ goal, ...meta }));
  } catch (error) {
    console.error('Error fetching goals data:', error);
    return [];
  }
}

export async function getCommunicationPatterns(
  userId: string,
  companionId: string
): Promise<AIAnalysisResult['communicationPatterns'] | null> {
  try {
    const { data: recentInsights } = await supabase
      .from('conversation_insights')
      .select('ai_analysis')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .not('ai_analysis', 'is', null)
      .order('conversation_date', { ascending: false })
      .limit(5);

    if (!recentInsights || recentInsights.length === 0) return null;

    const patterns = recentInsights
      .map(r => (r.ai_analysis as unknown as AIAnalysisResult)?.communicationPatterns)
      .filter(Boolean);

    if (patterns.length === 0) return null;

    return patterns[0];
  } catch (error) {
    console.error('Error fetching communication patterns:', error);
    return null;
  }
}

export async function generatePersonalizedInsights(
  userId: string,
  companionId: string
): Promise<string[]> {
  try {
    const { data: recentInsights } = await supabase
      .from('conversation_insights')
      .select('ai_analysis')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .not('ai_analysis', 'is', null)
      .order('conversation_date', { ascending: false })
      .limit(5);

    if (!recentInsights || recentInsights.length === 0) {
      return ['Start chatting to receive personalized insights'];
    }

    const allInsights: string[] = [];
    for (const row of recentInsights) {
      const ai = row.ai_analysis as unknown as AIAnalysisResult;
      if (ai?.personalizedInsights) {
        allInsights.push(...ai.personalizedInsights);
      }
    }

    const unique = [...new Set(allInsights)];
    return unique.slice(0, 5);
  } catch (error) {
    console.error('Error generating personalized insights:', error);
    return ['Unable to generate insights at this time'];
  }
}
