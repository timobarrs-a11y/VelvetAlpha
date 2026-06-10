import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, MapPin, Repeat, Tag } from 'lucide-react';
import type { UserEvent } from '../../services/calendarService';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Partial<UserEvent>) => void;
  event?: UserEvent | null;
  defaultDate?: string;
}

const EVENT_TYPE_GROUPS: { label: string; types: { value: string; label: string; color: string }[] }[] = [
  {
    label: 'General',
    types: [
      { value: 'reminder',    label: 'Reminder',    color: 'bg-blue-500' },
      { value: 'task',        label: 'Task',        color: 'bg-emerald-500' },
      { value: 'appointment', label: 'Appointment', color: 'bg-teal-500' },
      { value: 'goal_deadline', label: 'Goal',      color: 'bg-cyan-500' },
    ],
  },
  {
    label: 'Family',
    types: [
      { value: 'birthday',           label: 'Birthday',       color: 'bg-pink-500' },
      { value: 'vacation',           label: 'Vacation',       color: 'bg-sky-500' },
      { value: 'kids_event',         label: "Kids' Event",    color: 'bg-orange-500' },
      { value: 'graduation',         label: 'Graduation',     color: 'bg-amber-400' },
      { value: 'doctor_appointment', label: 'Doctor Appt',    color: 'bg-rose-400' },
    ],
  },
  {
    label: 'Personal',
    types: [
      { value: 'anniversary',     label: 'Anniversary',     color: 'bg-rose-500' },
      { value: 'milestone',       label: 'Milestone',       color: 'bg-amber-500' },
      { value: 'personal_holiday',label: 'Personal Holiday',color: 'bg-fuchsia-500' },
      { value: 'date_idea',       label: 'Date Idea',       color: 'bg-red-500' },
    ],
  },
  {
    label: 'Community',
    types: [
      { value: 'community_holiday', label: 'Community Day',   color: 'bg-green-500' },
      { value: 'national_day',      label: 'National Day',    color: 'bg-yellow-500' },
    ],
  },
];

const RECURRING_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
] as const;

export function EventModal({ isOpen, onClose, onSave, event, defaultDate }: EventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<string>('reminder');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [location, setLocation] = useState('');
  const [recurring, setRecurring] = useState('none');

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setEventType(event.event_type);
      const d = new Date(event.event_date);
      setEventDate(d.toISOString().split('T')[0]);
      if (!event.all_day) {
        setEventTime(d.toTimeString().slice(0, 5));
      }
      setAllDay(event.all_day);
      setLocation(event.location || '');
      setRecurring(event.recurring);
    } else {
      setTitle('');
      setDescription('');
      setEventType('reminder');
      setEventDate(defaultDate || new Date().toISOString().split('T')[0]);
      setEventTime('');
      setAllDay(true);
      setLocation('');
      setRecurring('none');
    }
  }, [event, isOpen, defaultDate]);

  const handleSubmit = () => {
    if (!title.trim() || !eventDate) return;

    let dateStr = eventDate;
    if (!allDay && eventTime) {
      dateStr = `${eventDate}T${eventTime}:00`;
    } else {
      dateStr = `${eventDate}T00:00:00`;
    }

    onSave({
      ...(event?.id ? { id: event.id } : {}),
      title: title.trim(),
      description: description.trim(),
      event_type: eventType as UserEvent['event_type'],
      event_date: new Date(dateStr).toISOString(),
      all_day: allDay,
      location: location.trim() || null,
      recurring: recurring as UserEvent['recurring'],
    });

    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">
                {event ? 'Edit Event' : 'New Event'}
              </h2>
              <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Event title"
                  autoFocus
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-lg placeholder-gray-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                  <Tag className="w-3 h-3" /> Type
                </label>
                <div className="space-y-2.5">
                  {EVENT_TYPE_GROUPS.map(group => (
                    <div key={group.label}>
                      <p className="text-[9.5px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">{group.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.types.map(type => (
                          <button
                            key={type.value}
                            onClick={() => setEventType(type.value)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                              eventType === type.value
                                ? `${type.color} text-white`
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Date
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>
                {!allDay && (
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Time
                    </label>
                    <input
                      type="time"
                      value={eventTime}
                      onChange={e => setEventTime(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={e => setAllDay(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-amber-500 focus:ring-amber-500/20"
                />
                <span className="text-sm text-gray-300">All day</span>
              </label>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Location (optional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Add a location"
                  className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-sm placeholder-gray-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <Repeat className="w-3 h-3" /> Repeat
                </label>
                <select
                  value={recurring}
                  onChange={e => setRecurring(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-none"
                >
                  {RECURRING_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add notes or details..."
                  rows={3}
                  className="w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-sm placeholder-gray-500 focus:border-amber-400 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-700 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || !eventDate}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-xl transition-all"
              >
                {event ? 'Update' : 'Create'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
