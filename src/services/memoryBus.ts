import { supabase } from '../shared/supabase/client';
import { getActiveGoals, formatGoalsForBrief, type UserGoal } from './goalService';

export type Surface =
  | 'atlas'
  | 'co-author'
  | 'calendar'
  | 'daily-feed'
  | 'insights'
  | 'daily-rituals'
  | 'morning-brief'
  | 'chat'
  | 'coach';

export interface UserFact {
  fact: string;
  category: string;
  confidence: number;
}

export interface CommitmentSummary {
  id: string;
  description: string;
  due_date: string | null;
  status: string;
  companion_id: string;
  goal_id: string | null;
}

export interface SessionSummary {
  id: string;
  companion_id: string;
  opened_at: string;
  closed_at: string | null;
  summary: string | null;
  status: string;
}

export interface MemoryContext {
  goals: UserGoal[];
  goalsText: string;
  facts: UserFact[];
  topics: string[];
  commitments: CommitmentSummary[];
  sessions: SessionSummary[];
  companionNames: Record<string, string>;
}

interface GetUserContextOptions {
  surface: Surface;
  companionId?: string;
  includeCommitments?: boolean;
  includeSessions?: boolean;
  maxFacts?: number;
  maxTopics?: number;
}

const DEFAULT_MAX_FACTS = 12;
const DEFAULT_MAX_TOPICS = 8;

async function fetchGoals(userId: string): Promise<UserGoal[]> {
  try {
    return await getActiveGoals(userId);
  } catch {
    return [];
  }
}

async function fetchFacts(
  userId: string,
  maxFacts: number
): Promise<UserFact[]> {
  try {
    const { data } = await supabase
      .from('user_insights')
      .select('facts_learned, confidence_score, last_confirmed_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (!data || data.length === 0) return [];

    const factMap = new Map<string, UserFact>();

    for (const row of data) {
      const facts = row.facts_learned as unknown as Array<{ fact: string; category: string }>;
      if (!Array.isArray(facts)) continue;

      const rowConfidence = row.confidence_score ?? 0.5;

      for (const f of facts) {
        if (!f?.fact || factMap.has(f.fact)) continue;
        factMap.set(f.fact, {
          fact: f.fact,
          category: f.category || 'general',
          confidence: rowConfidence,
        });
        if (factMap.size >= maxFacts) break;
      }
      if (factMap.size >= maxFacts) break;
    }

    return Array.from(factMap.values()).filter((f) => f.confidence >= 0.4);
  } catch {
    return [];
  }
}

async function fetchTopics(
  userId: string,
  maxTopics: number
): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('conversation_insights')
      .select('topics')
      .eq('user_id', userId)
      .order('conversation_date', { ascending: false })
      .limit(10);

    if (!data || data.length === 0) return [];

    const topicCounts = new Map<string, number>();

    for (const row of data) {
      const topics = row.topics as unknown as string[];
      if (!Array.isArray(topics)) continue;
      for (const t of topics) {
        if (t) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
      }
    }

    return Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxTopics)
      .map(([t]) => t);
  } catch {
    return [];
  }
}

async function fetchCommitments(
  userId: string,
  companionId?: string
): Promise<CommitmentSummary[]> {
  try {
    let query = supabase
      .from('coaching_commitments')
      .select('id, description, due_date, status, companion_id, goal_id')
      .eq('user_id', userId)
      .in('status', ['pending', 'missed'])
      .order('due_date', { ascending: false, nullsFirst: false })
      .limit(10);

    if (companionId) {
      query = query.eq('companion_id', companionId);
    }

    const { data } = await query;
    return (data ?? []) as unknown as CommitmentSummary[];
  } catch {
    return [];
  }
}

async function fetchSessions(
  userId: string,
  companionId?: string,
  limit: number = 3
): Promise<SessionSummary[]> {
  try {
    let query = supabase
      .from('coaching_sessions')
      .select('id, companion_id, opened_at, closed_at, summary, status')
      .eq('user_id', userId)
      .order('opened_at', { ascending: false })
      .limit(limit);

    if (companionId) {
      query = query.eq('companion_id', companionId);
    }

    const { data } = await query;
    return (data ?? []) as unknown as SessionSummary[];
  } catch {
    return [];
  }
}

async function fetchCompanionNames(
  companionIds: string[]
): Promise<Record<string, string>> {
  if (companionIds.length === 0) return {};

  try {
    const uniqueIds = [...new Set(companionIds)];
    const { data } = await supabase
      .from('companions')
      .select('id, name')
      .in('id', uniqueIds);

    if (!data) return {};

    const map: Record<string, string> = {};
    for (const c of data) {
      map[c.id] = c.name;
    }
    return map;
  } catch {
    return {};
  }
}

function factsToText(facts: UserFact[]): string {
  if (facts.length === 0) return '';
  const lines = facts.map(
    (f) => `- [VERIFIED] ${f.fact} (category: ${f.category})`
  );
  return `[USER FACTS — verified from conversation memory]\n${lines.join('\n')}\n[END USER FACTS]`;
}

function topicsToText(topics: string[]): string {
  if (topics.length === 0) return '';
  return `[RECENT TOPICS]\n${topics.join(', ')}\n[END TOPICS]`;
}

function commitmentsToText(
  commitments: CommitmentSummary[],
  companionNames: Record<string, string>
): string {
  if (commitments.length === 0) return '';

  const lines = commitments.map((c) => {
    let line = `- ${c.description}`;
    if (c.due_date) {
      const due = new Date(c.due_date);
      const now = new Date();
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);
      if (daysLeft < 0) {
        line += ` — OVERDUE by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`;
      } else if (daysLeft === 0) {
        line += ` — due TODAY`;
      } else {
        line += ` — due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
      }
    }
    if (c.status === 'missed') line += ' [MISSED]';
    const coachName = companionNames[c.companion_id];
    if (coachName) line += ` (from ${coachName})`;
    return line;
  });

  return `[OPEN COMMITMENTS — reference these specifically, do not invent new ones]\n${lines.join('\n')}\n[END COMMITMENTS]`;
}

function sessionsToText(
  sessions: SessionSummary[],
  companionNames: Record<string, string>
): string {
  const closed = sessions.filter((s) => s.summary);
  if (closed.length === 0) return '';

  const lines = closed.map((s) => {
    const name = companionNames[s.companion_id] ?? 'coach';
    const date = new Date(s.opened_at).toLocaleDateString();
    return `- ${date} with ${name}: ${s.summary}`;
  });

  return `[RECENT SESSION SUMMARIES]\n${lines.join('\n')}\n[END SESSIONS]`;
}

export async function getUserContext(
  userId: string,
  options: GetUserContextOptions
): Promise<MemoryContext> {
  const {
    surface,
    companionId,
    includeCommitments = false,
    includeSessions = false,
    maxFacts = DEFAULT_MAX_FACTS,
    maxTopics = DEFAULT_MAX_TOPICS,
  } = options;

  const [goals, facts, topics] = await Promise.all([
    fetchGoals(userId),
    fetchFacts(userId, maxFacts),
    fetchTopics(userId, maxTopics),
  ]);

  const goalsText = formatGoalsForBrief(goals);

  let commitments: CommitmentSummary[] = [];
  let sessions: SessionSummary[] = [];

  if (includeCommitments) {
    commitments = await fetchCommitments(userId, surface === 'coach' ? companionId : undefined);
  }

  if (includeSessions) {
    sessions = await fetchSessions(userId, surface === 'coach' ? companionId : undefined);
  }

  const companionIds = [
    ...commitments.map((c) => c.companion_id),
    ...sessions.map((s) => s.companion_id),
    ...goals.map((g) => g.source_companion_id).filter(Boolean) as string[],
  ];
  const companionNames = await fetchCompanionNames(companionIds);

  return {
    goals,
    goalsText,
    facts,
    topics,
    commitments,
    sessions,
    companionNames,
  };
}

export function contextToPromptBlock(ctx: MemoryContext, options: {
  includeGoals?: boolean;
  includeFacts?: boolean;
  includeTopics?: boolean;
  includeCommitments?: boolean;
  includeSessions?: boolean;
}): string {
  const {
    includeGoals = true,
    includeFacts = true,
    includeTopics = true,
    includeCommitments = false,
    includeSessions = false,
  } = options;

  const parts: string[] = [];

  if (includeGoals && ctx.goalsText) {
    parts.push(`\n\n${ctx.goalsText}`);
  }
  if (includeFacts) {
    const text = factsToText(ctx.facts);
    if (text) parts.push(`\n\n${text}`);
  }
  if (includeTopics) {
    const text = topicsToText(ctx.topics);
    if (text) parts.push(`\n\n${text}`);
  }
  if (includeCommitments) {
    const text = commitmentsToText(ctx.commitments, ctx.companionNames);
    if (text) parts.push(`\n\n${text}`);
  }
  if (includeSessions) {
    const text = sessionsToText(ctx.sessions, ctx.companionNames);
    if (text) parts.push(`\n\n${text}`);
  }

  return parts.join('');
}

export function getGoalDomains(goals: UserGoal[]): string[] {
  const domains = new Set<string>();
  for (const g of goals) {
    if (g.goal_type === 'health_fitness') domains.add('fitness');
    if (g.goal_type === 'reading') domains.add('education');
    if (g.goal_type === 'creative') domains.add('creative');
    if (g.goal_type === 'habit') domains.add('lifestyle');
    if (g.goal_type === 'deadline') domains.add('productivity');
    if (g.notes) {
      const words = g.notes.toLowerCase();
      if (words.includes('write') || words.includes('book') || words.includes('novel')) domains.add('writing');
      if (words.includes('run') || words.includes('gym') || words.includes('fitness')) domains.add('fitness');
      if (words.includes('code') || words.includes('program')) domains.add('technology');
    }
  }
  return Array.from(domains);
}

export async function writeUserFact(
  userId: string,
  fact: string,
  category: string,
  companionId?: string
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await supabase
      .from('user_insights')
      .select('id, facts_learned')
      .eq('user_id', userId)
      .eq('companion_id', companionId ?? null)
      .eq('period_start', today)
      .maybeSingle();

    const newFact = { fact, category };
    const confidenceScore = 0.6;

    if (existing) {
      const prevFacts = (existing.facts_learned as unknown as Array<{ fact: string; category: string }>) ?? [];
      const allFacts = [...prevFacts, newFact].filter(
        (f, i, arr) => arr.findIndex((x) => x.fact === f.fact) === i
      );

      await supabase
        .from('user_insights')
        .update({
          facts_learned: allFacts.slice(0, 30),
          confidence_score: confidenceScore,
          last_confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('user_insights').insert({
        user_id: userId,
        companion_id: companionId,
        period_start: today,
        period_end: today,
        total_conversations: 0,
        total_messages: 0,
        avg_conversation_length: 0,
        top_topics: [],
        sentiment_trend: [],
        facts_learned: [newFact],
        goals_mentioned: [],
        confidence_score: confidenceScore,
        last_confirmed_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('memoryBus.writeUserFact error:', error);
  }
}
