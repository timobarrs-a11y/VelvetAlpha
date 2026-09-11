import { Calendar, Clock, MapPin, Sun, Sunrise, Moon, Sunset } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LocalDateParts } from '../services/temporalAwarenessService';
import type { UserEvent } from '../services/calendarService';
import type { CompanionWithLastMessage } from '../services/companionService';

export type TimeOfDayBucket = LocalDateParts['timeOfDay'];

interface TimeAwareSlotProps {
  bucket: TimeOfDayBucket;
  todaysEvents: UserEvent[];
  tomorrowsEvents: UserEvent[];
  companion: CompanionWithLastMessage | null;
  companionNarrative: string | null;
}

const BUCKET_ICON: Record<TimeOfDayBucket, typeof Sun> = {
  'early morning': Sunrise,
  'morning': Sun,
  'midday': Sun,
  'afternoon': Sun,
  'evening': Sunset,
  'night': Moon,
  'late night': Moon,
};

const BUCKET_GREETING: Record<TimeOfDayBucket, string> = {
  'early morning': 'Early morning',
  'morning': 'Good morning',
  'midday': 'Good afternoon',
  'afternoon': 'Good afternoon',
  'evening': 'Good evening',
  'night': 'Good night',
  'late night': 'Late night',
};

const WARM_BUCKETS: TimeOfDayBucket[] = ['early morning', 'morning'];
const COOL_BUCKETS: TimeOfDayBucket[] = ['evening', 'night', 'late night'];

export function getBucketTintClass(bucket: TimeOfDayBucket): string {
  if (WARM_BUCKETS.includes(bucket)) return 'time-tint--warm';
  if (COOL_BUCKETS.includes(bucket)) return 'time-tint--cool';
  return '';
}

function isSameDay(dateStr: string, ref: Date): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate();
}

function formatEventTime(event: UserEvent): string {
  if (event.all_day) return 'All day';
  if (event.reminder_time) {
    try {
      const [h, m] = event.reminder_time.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
    } catch {
      return event.reminder_time;
    }
  }
  const d = new Date(event.event_date);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function EventSlot({ event, label, isTomorrow }: { event: UserEvent; label: string; isTomorrow?: boolean }) {
  const time = formatEventTime(event);
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="ds-card rounded-xl p-4 flex items-center gap-4"
    >
      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex-shrink-0">
        <Calendar className="w-5 h-5 text-emerald-400 mb-0.5" />
        <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{event.title}</p>
        <div className="flex items-center gap-3 mt-1 text-white/40 text-xs">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {isTomorrow ? 'Tomorrow' : 'Today'} · {time}
          </span>
          {event.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3" />
              {event.location}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CompanionNarrativeSlot({ companion, narrative }: { companion: CompanionWithLastMessage; narrative: string }) {
  const excerpt = narrative.length > 240 ? narrative.slice(0, 240).trimEnd() + '...' : narrative;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      className="ds-card rounded-xl p-4 flex items-start gap-4"
    >
      <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-violet-500/10 border border-violet-400/20 flex-shrink-0">
        <Moon className="w-5 h-5 text-violet-300 mb-0.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white/60 text-xs font-medium mb-1">
          {companion.custom_name}'s day
        </p>
        <p className="text-white/80 text-sm leading-relaxed italic">{excerpt}</p>
      </div>
    </motion.div>
  );
}

export function TimeAwareSlot({ bucket, todaysEvents, tomorrowsEvents, companion, companionNarrative }: TimeAwareSlotProps) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todays = todaysEvents.filter(e => isSameDay(e.event_date, today));
  const tomorrows = tomorrowsEvents.filter(e => isSameDay(e.event_date, tomorrow));

  const isMorning = WARM_BUCKETS.includes(bucket);
  const isEvening = COOL_BUCKETS.includes(bucket);

  let content: React.ReactNode = null;

  if (isMorning && todays.length > 0) {
    const nextEvent = todays[0];
    content = <EventSlot event={nextEvent} label="Today" />;
  } else if (isEvening) {
    if (tomorrows.length > 0) {
      content = <EventSlot event={tomorrows[0]} label="Tomorrow" isTomorrow />;
    } else if (companion && companionNarrative) {
      content = <CompanionNarrativeSlot companion={companion} narrative={companionNarrative} />;
    }
  }

  const Icon = BUCKET_ICON[bucket];
  const greeting = BUCKET_GREETING[bucket];

  return (
    <AnimatePresence mode="wait">
      {content && (
        <motion.div
          key={bucket}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2 mb-3">
            <Icon className="w-4 h-4 text-white/40" />
            <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">{greeting}</span>
          </div>
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
