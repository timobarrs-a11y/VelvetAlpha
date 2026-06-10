export interface LocalDateParts {
  dayOfWeek: string;
  monthName: string;
  dateNumber: number;
  year: number;
  timeOfDay: 'early morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | 'late night';
  isWeekend: boolean;
  hour: number;
}

export interface GapContext {
  gapHours: number;
  gapDays: number;
  gapFriendly: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (e) {
    return 'UTC';
  }
}

function getTimeOfDayBucket(hour: number): LocalDateParts['timeOfDay'] {
  if (hour >= 4 && hour < 7) return 'early morning';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  if (hour >= 22 || hour < 2) return 'night';
  return 'late night';
}

export function getUserLocalDateParts(now: Date, timezone?: string): LocalDateParts {
  const tz = timezone || getUserTimezone();

  const localDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));

  const dayOfWeek = DAY_NAMES[localDate.getDay()];
  const monthName = MONTH_NAMES[localDate.getMonth()];
  const dateNumber = localDate.getDate();
  const year = localDate.getFullYear();
  const hour = localDate.getHours();
  const timeOfDay = getTimeOfDayBucket(hour);
  const isWeekend = localDate.getDay() === 0 || localDate.getDay() === 6;

  return {
    dayOfWeek,
    monthName,
    dateNumber,
    year,
    timeOfDay,
    isWeekend,
    hour
  };
}

export function getLocalDateString(date: Date, timezone?: string): string {
  const tz = timezone || getUserTimezone();
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));

  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatTodayContext(dateParts: LocalDateParts): string {
  const { dayOfWeek, monthName, dateNumber, timeOfDay } = dateParts;

  const ordinal = getOrdinalSuffix(dateNumber);
  return `Today is ${dayOfWeek}, ${monthName} ${dateNumber}${ordinal}. It's ${timeOfDay}.`;
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function calculateGapSinceLastChat(
  lastInteractionAt: Date | string,
  now: Date,
  timezone?: string
): GapContext {
  const lastDate = typeof lastInteractionAt === 'string'
    ? new Date(lastInteractionAt)
    : lastInteractionAt;

  const gapMs = now.getTime() - lastDate.getTime();
  const gapHours = Math.floor(gapMs / (1000 * 60 * 60));
  const gapMinutes = Math.floor((gapMs % (1000 * 60 * 60)) / (1000 * 60));
  const gapDays = Math.floor(gapHours / 24);

  let gapFriendly: string;

  if (gapHours === 0) {
    if (gapMinutes <= 1) {
      gapFriendly = 'just now';
    } else if (gapMinutes < 5) {
      gapFriendly = 'a few minutes ago';
    } else {
      gapFriendly = `${gapMinutes} minutes ago`;
    }
  } else if (gapHours < 1) {
    gapFriendly = `${gapMinutes} minutes ago`;
  } else if (gapHours === 1) {
    gapFriendly = '1 hour ago';
  } else if (gapHours < 24) {
    gapFriendly = `${gapHours} hours ago`;
  } else if (gapDays === 1) {
    gapFriendly = 'yesterday';
  } else if (gapDays < 7) {
    gapFriendly = `${gapDays} days ago`;
  } else if (gapDays < 14) {
    gapFriendly = 'about a week ago';
  } else if (gapDays < 30) {
    gapFriendly = `${Math.floor(gapDays / 7)} weeks ago`;
  } else if (gapDays < 60) {
    gapFriendly = 'about a month ago';
  } else {
    gapFriendly = `${Math.floor(gapDays / 30)} months ago`;
  }

  return {
    gapHours,
    gapDays,
    gapFriendly
  };
}

export function computeStreak(
  currentLocalDate: string,
  lastInteractionLocalDate: string | null,
  currentStreakDays: number
): { newStreakDays: number; streakContinued: boolean; streakBroke: boolean } {
  if (!lastInteractionLocalDate) {
    return { newStreakDays: 1, streakContinued: true, streakBroke: false };
  }

  if (currentLocalDate === lastInteractionLocalDate) {
    return { newStreakDays: currentStreakDays, streakContinued: false, streakBroke: false };
  }

  const current = new Date(currentLocalDate);
  const last = new Date(lastInteractionLocalDate);
  const daysDiff = Math.floor((current.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff === 1) {
    return { newStreakDays: currentStreakDays + 1, streakContinued: true, streakBroke: false };
  } else {
    return { newStreakDays: 1, streakContinued: false, streakBroke: true };
  }
}

export interface TemporalPromptContext {
  todayContext: string;
  gapContext: string | null;
  relationshipContext: string | null;
  streakContext: string | null;
  fullContext: string;
}

export function formatTemporalPromptContext(params: {
  todayContext: string;
  gapContext?: GapContext;
  activeDays?: number;
  elapsedDays?: number;
  currentStreak?: number;
  longestStreak?: number;
  companionName?: string;
}): TemporalPromptContext {
  const { todayContext, gapContext, activeDays, elapsedDays, currentStreak, longestStreak, companionName } = params;

  let gapContextStr: string | null = null;
  if (gapContext) {
    if (gapContext.gapHours < 1) {
      gapContextStr = `You're talking right now.`;
    } else {
      gapContextStr = `You last talked ${gapContext.gapFriendly}.`;
    }
  }

  let relationshipContextStr: string | null = null;
  if (activeDays !== undefined && elapsedDays !== undefined) {
    const weeks = Math.floor(elapsedDays / 7);
    const months = Math.floor(elapsedDays / 30);

    let timeFrame = '';
    if (elapsedDays < 7) {
      timeFrame = `${elapsedDays} day${elapsedDays !== 1 ? 's' : ''}`;
    } else if (weeks < 8) {
      timeFrame = `~${weeks} week${weeks !== 1 ? 's' : ''}`;
    } else {
      timeFrame = `~${months} month${months !== 1 ? 's' : ''}`;
    }

    relationshipContextStr = `You've chatted on ${activeDays} different day${activeDays !== 1 ? 's' : ''} over ${timeFrame} since you met.`;
  }

  let streakContextStr: string | null = null;
  if (currentStreak !== undefined && currentStreak > 0) {
    if (currentStreak === 1) {
      streakContextStr = null;
    } else if (currentStreak < 3) {
      streakContextStr = `Current streak: ${currentStreak} days.`;
    } else {
      streakContextStr = `You're on a ${currentStreak}-day streak.`;
      if (longestStreak && currentStreak === longestStreak && currentStreak >= 7) {
        streakContextStr += ` That's your longest streak!`;
      }
    }
  }

  const parts: string[] = [todayContext];
  if (gapContextStr) parts.push(gapContextStr);
  if (relationshipContextStr) parts.push(relationshipContextStr);
  if (streakContextStr) parts.push(streakContextStr);

  const fullContext = parts.join(' ');

  return {
    todayContext,
    gapContext: gapContextStr,
    relationshipContext: relationshipContextStr,
    streakContext: streakContextStr,
    fullContext
  };
}

export function getWeekendContext(isWeekend: boolean, timeOfDay: string): string | null {
  if (isWeekend) {
    if (timeOfDay === 'morning' || timeOfDay === 'early morning') {
      return `It's the weekend, so they might be relaxed or sleeping in.`;
    } else {
      return `It's the weekend.`;
    }
  }
  return null;
}

export function getTimeOfDayContext(timeOfDay: string): string | null {
  switch (timeOfDay) {
    case 'late night':
      return `It's late at night - they might be having deep thoughts or can't sleep.`;
    case 'night':
      return `It's nighttime - winding down for the day.`;
    case 'early morning':
      return `It's very early in the morning - they might be starting their day or up early for a reason.`;
    default:
      return null;
  }
}
