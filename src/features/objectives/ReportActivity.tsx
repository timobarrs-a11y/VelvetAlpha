import { useEffect } from 'react';
import { reportActivity } from '../../services/dailyObjectivesService';

/** Put on a page to tell the server the person was there, for today's objectives. */
export function ReportActivity({ activity }: { activity: 'visit_town' | 'play_game' }) {
  useEffect(() => { reportActivity(activity); }, [activity]);
  return null;
}
