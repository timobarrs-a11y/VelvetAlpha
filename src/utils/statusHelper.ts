interface StatusTimelineEntry {
  time: string;
  status: string;
  activity: string;
}

function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

export function getCurrentStatus(statusTimeline: StatusTimelineEntry[]): StatusTimelineEntry | null {
  if (!statusTimeline || statusTimeline.length === 0) {
    return null;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const sortedEntries = [...statusTimeline]
    .map(entry => ({
      ...entry,
      totalMinutes: parseTimeToMinutes(entry.time)
    }))
    .sort((a, b) => a.totalMinutes - b.totalMinutes);

  let currentStatus = sortedEntries[0];

  for (const entry of sortedEntries) {
    if (entry.totalMinutes <= currentMinutes) {
      currentStatus = entry;
    } else {
      break;
    }
  }

  return currentStatus;
}
