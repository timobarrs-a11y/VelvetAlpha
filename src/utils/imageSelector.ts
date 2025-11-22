export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export const getTimeOfDay = (): TimeOfDay => {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 18) {
    return 'afternoon';
  } else if (hour >= 18 && hour < 24) {
    return 'evening';
  } else {
    return 'night';
  }
};

export const getCharacterImage = (timeOfDay: TimeOfDay, character: 'riley' | 'raven' | 'tyler' = 'riley'): string => {
  const rileyImages: Record<TimeOfDay, string> = {
    morning: '/images/riley-workout.jpg',
    afternoon: '/images/riley-cheerleader.jpg',
    evening: '/images/riley-evening.jpg',
    night: '/images/riley-casual.jpg',
  };

  const ravenImages: Record<TimeOfDay, string> = {
    morning: '/images/raven-morning.jpg',
    afternoon: '/images/raven-afternoon.jpg',
    evening: '/images/raven-evening.jpg',
    night: '/images/raven-night.jpg',
  };

  const tylerImages: Record<TimeOfDay, string> = {
    morning: '/images/tyler-morning.jpg',
    afternoon: '/images/tyler-afternoon.jpg',
    evening: '/images/tyler-evening.jpg',
    night: '/images/tyler-night.jpg',
  };

  const imageMap = {
    riley: rileyImages,
    raven: ravenImages,
    tyler: tylerImages,
  };

  return imageMap[character][timeOfDay];
};

export const getTimeLabel = (timeOfDay: TimeOfDay): string => {
  const labels: Record<TimeOfDay, string> = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Night',
  };

  return labels[timeOfDay];
};
