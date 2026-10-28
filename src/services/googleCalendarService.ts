import { supabase } from '../shared/supabase/client';

export interface CalendarStatus { configured: boolean; connected: boolean; email: string | null }
export type PinResult = 'added' | 'updated' | 'removed' | 'failed';

/** Thrown when Google no longer accepts the saved connection, so the person needs to connect again. */
export class CalendarReconnect extends Error {}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('google-calendar', { body });
  if (error) {
    // A 409 from the function means "connect again"; its JSON body comes back on the error's context.
    const res = (error as { context?: Response }).context;
    if (res && res.status === 409) throw new CalendarReconnect();
    throw new Error(error.message || 'Google Calendar is unavailable right now.');
  }
  return data as T;
}

/** Whether pinning to Google Calendar is set up on the server, and whether this person has connected. */
export async function getCalendarStatus(): Promise<CalendarStatus> {
  try {
    return await call<CalendarStatus>({ action: 'status' });
  } catch {
    return { configured: false, connected: false, email: null };
  }
}

/** Sends the browser to Google; they come back to this page with ?calendar=connected. */
export async function connectCalendar(): Promise<void> {
  const { url } = await call<{ url: string }>({ action: 'start', returnPath: window.location.pathname });
  window.location.assign(url);
}

export async function disconnectCalendar(): Promise<void> {
  await call({ action: 'disconnect' });
}

export async function pinTasks(commitmentIds: string[]): Promise<Record<string, PinResult>> {
  const { results } = await call<{ results: Record<string, PinResult> }>({ action: 'add', commitmentIds });
  return results;
}

export async function unpinTasks(commitmentIds: string[]): Promise<Record<string, PinResult>> {
  const { results } = await call<{ results: Record<string, PinResult> }>({ action: 'remove', commitmentIds });
  return results;
}
