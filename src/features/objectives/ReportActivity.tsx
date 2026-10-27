import { useEffect } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { reportActivity, type ReportedKey } from '../../services/dailyObjectivesService';

/** Put on a page to tell the server the person was there, for today's objectives. */
export function ReportActivity({ activity }: { activity: ReportedKey | ReportedKey[] }) {
  const { user } = useAuth();
  const userId = user?.id;
  const key = Array.isArray(activity) ? activity.join(',') : activity;
  useEffect(() => { if (userId) key.split(',').forEach(k => reportActivity(k as ReportedKey)); }, [key, userId]);
  return null;
}
