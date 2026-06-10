import { supabase } from '../shared/supabase/client';
import { calendarService } from './calendarService';
import { newsService } from './newsService';
import { getSchedule, formatScheduleForBrief } from './userScheduleService';
import { getActiveGoals, formatGoalsForBrief } from './goalService';
import { formatNationalDaysForBrief } from '../data/nationalDays';

export interface BriefBlock {
  type: 'greeting' | 'calendar' | 'news' | 'navi' | 'goals';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface BriefResult {
  delivered: boolean;
  blocks: BriefBlock[];
  alreadyDeliveredToday: boolean;
}

function getGreeting(hour: number, companionName: string): string {
  if (hour >= 5 && hour < 12) {
    const greetings = [
      `Good morning. Let me get you set for the day.`,
      `Morning. Here's what's on deck.`,
      `Hey — good morning. Let me catch you up.`,
      `Rise and shine. Here's your day at a glance.`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  if (hour >= 12 && hour < 17) {
    return `Quick mid-day check-in from ${companionName}.`;
  }
  return `Evening. Let me catch you up.`;
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();

  if (isToday) return 'today';
  if (isTomorrow) return 'tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export interface BriefReadiness {
  score: number;          // 0–100
  isReady: boolean;       // true if score >= 40
  missing: BriefGap[];    // what would improve quality, in priority order
}

export type BriefGap =
  | 'schedule'    // No work schedule set
  | 'calendar'    // No upcoming calendar events
  | 'goals'       // No active goals
  | 'location';   // No location set (Navi needs it)

/**
 * Scores how much personalized context is available for the morning brief.
 * Score breakdown:
 *   schedule set         = 30 pts  (knows your day shape)
 *   calendar events      = 35 pts  (knows what's happening)
 *   active goals         = 25 pts  (knows what you're working toward)
 *   news categories set  = 10 pts  (at least knows what you care about)
 * Threshold: 40+ = ready to deliver a quality brief.
 */
export function scoreBriefReadiness(flags: {
  hasSchedule: boolean;
  hasCalendar: boolean;
  hasGoals: boolean;
  hasNews: boolean;
}): BriefReadiness {
  let score = 0;
  if (flags.hasSchedule) score += 30;
  if (flags.hasCalendar) score += 35;
  if (flags.hasGoals)    score += 25;
  if (flags.hasNews)     score += 10;

  const missing: BriefGap[] = [];
  if (!flags.hasCalendar) missing.push('calendar');
  if (!flags.hasSchedule) missing.push('schedule');
  if (!flags.hasGoals)    missing.push('goals');

  return { score, isReady: score >= 40, missing };
}

export const morningBriefService = {
  async checkAlreadyDelivered(userId: string, companionId: string): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('daily_briefs')
      .select('id')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .eq('date', today)
      .maybeSingle();
    return data !== null;
  },

  async markDelivered(
    userId: string,
    companionId: string,
    blocks: BriefBlock[]
  ): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from('daily_briefs').upsert({
      user_id: userId,
      companion_id: companionId,
      date: today,
      blocks_delivered: blocks.map(b => b.type),
      delivered_at: new Date().toISOString(),
    });
  },

  isMorningWindow(): boolean {
    const hour = new Date().getHours();
    return hour >= 5 && hour < 11;
  },

  async buildBrief(
    userId: string,
    companionId: string,
    companionName: string,
    userNewsCategories: string[]
  ): Promise<BriefBlock[]> {
    const blocks: BriefBlock[] = [];
    const hour = new Date().getHours();

    blocks.push({
      type: 'greeting',
      content: getGreeting(hour, companionName),
    });

    try {
      const upcomingEvents = await calendarService.getUpcomingEvents(userId, 3);
      if (upcomingEvents.length > 0) {
        const eventLines = upcomingEvents
          .slice(0, 3)
          .map(e => `• **${e.title}** — ${formatEventDate(e.event_date)}`)
          .join('\n');
        blocks.push({
          type: 'calendar',
          content: `You've got a few things coming up:\n${eventLines}`,
          metadata: { event_ids: upcomingEvents.slice(0, 3).map(e => e.id) },
        });
      } else {
        blocks.push({
          type: 'calendar',
          content: `Your calendar looks clear for the next few days. Want me to add anything?`,
        });
      }
    } catch {
      // skip calendar block on error
    }

    try {
      const categories = userNewsCategories.length > 0 ? userNewsCategories : ['general'];
      const articles = await newsService.getArticlesByCategories(categories, 5);
      if (articles.length > 0) {
        const top = articles[0];
        blocks.push({
          type: 'news',
          content: `Here's something from the feed: **${top.title}**${top.description ? `\n${top.description.slice(0, 120)}...` : ''}`,
          metadata: {
            article_id: top.id,
            article_title: top.title,
            article_url: top.url,
            article_source: top.source,
            article_image: top.image_url,
          },
        });
      }
    } catch {
      // skip news block on error
    }

    return blocks;
  },

  async getUserNewsCategories(userId: string): Promise<string[]> {
    const { data } = await supabase
      .from('user_profiles')
      .select('news_categories')
      .eq('id', userId)
      .maybeSingle();
    return (data?.news_categories as string[]) ?? [];
  },

  async fetchBriefContext(
    userId: string,
    _companionId: string,
    _companionName: string
  ): Promise<{
    calendar: string; news: string; schedule: string;
    goals: string; nationalDay: string; politics: string;
    hasCalendar: boolean; hasNews: boolean; hasSchedule: boolean;
    hasGoals: boolean; hasNationalDay: boolean; hasPolitics: boolean;
  }> {
    let calendarText = '';
    let newsText = '';
    let scheduleText = '';
    let goalsText = '';
    let nationalDayText = '';
    let politicsText = '';
    let hasCalendar = false;
    let hasNews = false;
    let hasSchedule = false;
    let hasGoals = false;
    let hasNationalDay = false;
    let hasPolitics = false;

    try {
      const upcomingEvents = await calendarService.getUpcomingEvents(userId, 5);
      if (upcomingEvents.length > 0) {
        const eventLines = upcomingEvents
          .slice(0, 5)
          .map(e => `- ${e.title} (${formatEventDate(e.event_date)})`)
          .join('\n');
        calendarText = `The user has these upcoming calendar events:\n${eventLines}`;
        hasCalendar = true;
      }
      // Empty calendar = we know it's clear but it's not meaningful context for readiness scoring
    } catch {
      calendarText = '';
    }

    try {
      const newsCategories = await morningBriefService.getUserNewsCategories(userId);
      const categories = newsCategories.length > 0 ? newsCategories : ['general'];
      const { newsService } = await import('./newsService');
      const articles = await newsService.getArticlesByCategories(categories, 5);
      if (articles.length > 0) {
        const articleLines = articles
          .slice(0, 3)
          .map((a: { title: string; description?: string; source?: string }) =>
            `- "${a.title}"${a.source ? ` (${a.source})` : ''}${a.description ? `: ${a.description.slice(0, 100)}` : ''}`
          )
          .join('\n');
        newsText = `Here are some recent news headlines the user might find interesting:\n${articleLines}`;
        hasNews = true;
      }
    } catch {
      newsText = '';
    }

    try {
      const schedule = await getSchedule(userId);
      const formatted = formatScheduleForBrief(schedule);
      if (formatted) {
        scheduleText = formatted;
        hasSchedule = true;
      }
    } catch {
      scheduleText = '';
    }

    try {
      const goals = await getActiveGoals(userId);
      const formatted = formatGoalsForBrief(goals);
      if (formatted) {
        goalsText = formatted;
        hasGoals = true;
      }
    } catch {
      goalsText = '';
    }

    // National days are client-side — no async needed
    const nationalDayStr = formatNationalDaysForBrief(new Date());
    if (nationalDayStr) {
      nationalDayText = `Today's notable or fun day(s): ${nationalDayStr}`;
      hasNationalDay = true;
    }

    // Optional politics: fetch leaning and add a context note for the AI
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('political_leaning')
        .eq('id', userId)
        .maybeSingle();
      const leaning = profile?.political_leaning as string | null;
      if (leaning) {
        const leaningLabel = leaning === 'democrat' ? 'left-leaning / Democratic'
          : leaning === 'republican' ? 'right-leaning / Republican'
          : 'politically independent';
        politicsText = `The user identifies as ${leaningLabel}. When surfacing political news today, lean toward headlines and angles that would resonate with their perspective. Stay factual and balanced, but prioritize relevance.`;
        hasPolitics = true;
      }
    } catch {
      // skip politics if unavailable
    }

    return {
      calendar: calendarText,
      news: newsText,
      schedule: scheduleText,
      goals: goalsText,
      nationalDay: nationalDayText,
      politics: politicsText,
      hasCalendar,
      hasNews,
      hasSchedule,
      hasGoals,
      hasNationalDay,
      hasPolitics,
    };
  },
};
