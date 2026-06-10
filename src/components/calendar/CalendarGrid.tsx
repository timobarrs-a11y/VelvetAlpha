import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { UserEvent } from '../../services/calendarService';

interface CalendarGridProps {
  currentDate: Date;
  events: UserEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const EVENT_TYPE_DOTS: Record<string, string> = {
  reminder: 'bg-blue-400',
  appointment: 'bg-teal-400',
  anniversary: 'bg-rose-400',
  birthday: 'bg-pink-400',
  milestone: 'bg-amber-400',
  date_idea: 'bg-red-400',
  task: 'bg-emerald-400',
  goal_deadline: 'bg-cyan-400',
  relationship_anchor: 'bg-violet-400',
  relationship_milestone: 'bg-fuchsia-400',
  // New types
  vacation: 'bg-sky-400',
  kids_event: 'bg-orange-400',
  graduation: 'bg-amber-300',
  doctor_appointment: 'bg-rose-300',
  personal_holiday: 'bg-fuchsia-400',
  community_holiday: 'bg-green-400',
  national_day: 'bg-yellow-400',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function CalendarGrid({ currentDate, events, selectedDate, onSelectDate }: CalendarGridProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const dateToEventsMap = useMemo(() => {
    const map = new Map<string, UserEvent[]>();
    events.forEach(e => {
      const d = new Date(e.event_date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const existing = map.get(dateStr) || [];
      map.set(dateStr, [...existing, e]);
    });
    return map;
  }, [events]);

  const getEventsForDate = (day: number): UserEvent[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateToEventsMap.get(dateStr) || [];
  };

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const prevMonthDays = getDaysInMonth(year, month - 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => prevMonthDays - firstDay + 1 + i);
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const remainingSlots = (7 - ((firstDay + daysInMonth) % 7)) % 7;
  const nextDays = Array.from({ length: remainingSlots }, (_, i) => i + 1);

  return (
    <div>
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map(day => (
          <div key={day} className="text-center text-[11px] font-semibold text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {emptyDays.map((day, i) => (
          <div key={`prev-${i}`} className="aspect-square p-1 flex flex-col items-center justify-start pt-1.5">
            <span className="text-xs text-gray-700">{day}</span>
          </div>
        ))}

        {monthDays.map(day => {
          const dateStr = getDateStr(day);
          const dayEvents = getEventsForDate(day);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;

          return (
            <motion.button
              key={day}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectDate(dateStr)}
              className={`aspect-square p-1 flex flex-col items-center justify-start pt-1.5 rounded-xl transition-all relative ${
                isSelected
                  ? 'bg-amber-500/20 border border-amber-500/40'
                  : isToday
                  ? 'bg-gray-700/40 border border-gray-600'
                  : 'hover:bg-gray-800/50 border border-transparent'
              }`}
            >
              <span className={`text-xs font-medium ${
                isSelected ? 'text-amber-300' : isToday ? 'text-white font-bold' : 'text-gray-300'
              }`}>
                {day}
              </span>

              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                  {dayEvents.slice(0, 3).map((evt, i) => (
                    <div
                      key={i}
                      className={`w-1 h-1 rounded-full ${EVENT_TYPE_DOTS[evt.event_type] || 'bg-gray-400'}`}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[8px] text-gray-500">+{dayEvents.length - 3}</span>
                  )}
                </div>
              )}
            </motion.button>
          );
        })}

        {nextDays.map((day, i) => (
          <div key={`next-${i}`} className="aspect-square p-1 flex flex-col items-center justify-start pt-1.5">
            <span className="text-xs text-gray-700">{day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
