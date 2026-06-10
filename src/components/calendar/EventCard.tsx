import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin, Repeat, Check, Trash2, CreditCard as Edit3, X } from 'lucide-react';
import type { UserEvent } from '../../services/calendarService';

interface EventCardProps {
  event: UserEvent;
  onEdit: (event: UserEvent) => void;
  onDelete: (eventId: string) => void;
  onToggleComplete: (eventId: string, completed: boolean) => void;
}

const EVENT_TYPE_STYLES: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  reminder:             { bg: 'bg-blue-500/10',     border: 'border-blue-500/20',     dot: 'bg-blue-400',     label: 'Reminder' },
  appointment:          { bg: 'bg-teal-500/10',     border: 'border-teal-500/20',     dot: 'bg-teal-400',     label: 'Appointment' },
  anniversary:          { bg: 'bg-rose-500/10',     border: 'border-rose-500/20',     dot: 'bg-rose-400',     label: 'Anniversary' },
  birthday:             { bg: 'bg-pink-500/10',     border: 'border-pink-500/20',     dot: 'bg-pink-400',     label: 'Birthday' },
  milestone:            { bg: 'bg-amber-500/10',    border: 'border-amber-500/20',    dot: 'bg-amber-400',    label: 'Milestone' },
  date_idea:            { bg: 'bg-red-500/10',      border: 'border-red-500/20',      dot: 'bg-red-400',      label: 'Date Idea' },
  task:                 { bg: 'bg-emerald-500/10',  border: 'border-emerald-500/20',  dot: 'bg-emerald-400',  label: 'Task' },
  goal_deadline:        { bg: 'bg-cyan-500/10',     border: 'border-cyan-500/20',     dot: 'bg-cyan-400',     label: 'Goal' },
  relationship_anchor:  { bg: 'bg-violet-500/10',   border: 'border-violet-500/20',   dot: 'bg-violet-400',   label: 'Anchor' },
  relationship_milestone:{ bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20',  dot: 'bg-fuchsia-400',  label: 'Milestone' },
  // New family types
  vacation:             { bg: 'bg-sky-500/10',      border: 'border-sky-500/20',      dot: 'bg-sky-400',      label: 'Vacation' },
  kids_event:           { bg: 'bg-orange-500/10',   border: 'border-orange-500/20',   dot: 'bg-orange-400',   label: "Kids' Event" },
  graduation:           { bg: 'bg-amber-400/10',    border: 'border-amber-400/20',    dot: 'bg-amber-300',    label: 'Graduation' },
  doctor_appointment:   { bg: 'bg-rose-400/10',     border: 'border-rose-400/20',     dot: 'bg-rose-300',     label: 'Doctor Appt' },
  personal_holiday:     { bg: 'bg-fuchsia-500/10',  border: 'border-fuchsia-500/20',  dot: 'bg-fuchsia-400',  label: 'Personal Holiday' },
  community_holiday:    { bg: 'bg-green-500/10',    border: 'border-green-500/20',    dot: 'bg-green-400',    label: 'Community Day' },
  national_day:         { bg: 'bg-yellow-500/10',   border: 'border-yellow-500/20',   dot: 'bg-yellow-400',   label: 'National Day' },
};

export function EventCard({ event, onEdit, onDelete, onToggleComplete }: EventCardProps) {
  const [pendingDelete, setPendingDelete] = useState(false);
  const style = EVENT_TYPE_STYLES[event.event_type] || EVENT_TYPE_STYLES.reminder;
  const eventDate = new Date(event.event_date);
  const timeStr = event.all_day ? 'All day' : eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group ${style.bg} border ${style.border} rounded-xl p-4 transition-all hover:shadow-md`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggleComplete(event.id, !event.completed)}
          className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            event.completed
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-gray-500 hover:border-gray-400'
          }`}
        >
          {event.completed && <Check className="w-3 h-3 text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${style.dot}`} />
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {style.label}
            </span>
          </div>

          <h3 className={`text-sm font-semibold text-white mb-1 ${event.completed ? 'line-through opacity-50' : ''}`}>
            {event.title}
          </h3>

          {event.description && (
            <p className="text-xs text-gray-400 mb-2 line-clamp-2">{event.description}</p>
          )}

          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeStr}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {event.location}
              </span>
            )}
            {event.recurring !== 'none' && (
              <span className="flex items-center gap-1">
                <Repeat className="w-3 h-3" />
                {event.recurring}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {pendingDelete ? (
            <>
              <button
                onClick={() => onDelete(event.id)}
                className="px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-[11px] rounded-lg transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setPendingDelete(false)}
                className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onEdit(event)}
                className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <button
                onClick={() => setPendingDelete(true)}
                className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
