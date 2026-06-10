import { supabase } from '../shared/supabase/client';

export type WorkType = 'office' | 'remote' | 'hybrid' | 'shift' | 'freelance' | 'student' | 'none';
export type SchoolPickupTime = 'morning' | 'afternoon' | 'both';

export interface UserSchedule {
  user_id: string;
  work_type: WorkType;
  work_start_hour: number | null;
  work_end_hour: number | null;
  has_morning_commute: boolean;
  has_evening_commute: boolean;
  has_school_pickup: boolean;
  school_pickup_time: SchoolPickupTime | null;
  has_recurring_appointments: boolean;
  appointment_notes: string | null;
  extra_context: string | null;
  updated_at: string;
}

export type ScheduleInput = Omit<UserSchedule, 'user_id' | 'updated_at'>;

export async function getSchedule(userId: string): Promise<UserSchedule | null> {
  const { data } = await supabase
    .from('user_daily_schedule')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function upsertSchedule(userId: string, schedule: ScheduleInput): Promise<void> {
  await supabase
    .from('user_daily_schedule')
    .upsert(
      { ...schedule, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
}

export function formatScheduleForBrief(schedule: UserSchedule | null): string {
  if (!schedule) return '';

  const parts: string[] = [];

  if (schedule.work_type && schedule.work_type !== 'none') {
    const workLabel = {
      office: 'works in an office',
      remote: 'works from home',
      hybrid: 'works hybrid (office + home)',
      shift: 'works shift hours',
      freelance: 'freelances',
      student: 'is a student',
    }[schedule.work_type] || '';

    if (workLabel) {
      let workStr = `The user ${workLabel}`;
      if (schedule.work_start_hour != null && schedule.work_end_hour != null) {
        workStr += ` roughly ${formatHour(schedule.work_start_hour)} to ${formatHour(schedule.work_end_hour)}`;
      }
      parts.push(workStr + '.');
    }
  }

  if (schedule.has_morning_commute && schedule.has_evening_commute) {
    parts.push('They commute in both the morning and evening.');
  } else if (schedule.has_morning_commute) {
    parts.push('They have a morning commute.');
  } else if (schedule.has_evening_commute) {
    parts.push('They have an evening commute.');
  }

  if (schedule.has_school_pickup) {
    const when = {
      morning: 'morning school drop-off',
      afternoon: 'afternoon school pickup',
      both: 'morning drop-off and afternoon school pickup',
    }[schedule.school_pickup_time || 'afternoon'] || 'school pickup';
    parts.push(`They handle ${when}.`);
  }

  if (schedule.has_recurring_appointments && schedule.appointment_notes) {
    parts.push(`Recurring appointments: ${schedule.appointment_notes}`);
  }

  if (schedule.extra_context) {
    parts.push(schedule.extra_context);
  }

  return parts.join(' ');
}

function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour === 12) return 'noon';
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}
