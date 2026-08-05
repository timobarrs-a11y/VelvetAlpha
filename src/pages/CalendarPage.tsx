import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, Loader, Sparkles, Calendar, Check, X, CalendarDays } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../shared/supabase/client';
import { calendarService, UserEvent, EventSuggestion } from '../services/calendarService';
import { relationshipCalendarService } from '../services/relationshipCalendarService';
import { getCompanions } from '../services/companionService';
import { CalendarGrid } from '../components/calendar/CalendarGrid';
import { EventCard } from '../components/calendar/EventCard';
import { EventModal } from '../components/calendar/EventModal';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function CalendarPage({ onBack }: { onBack?: () => void } = {}) {
  const navigate = useNavigate();
  const goBack = () => { if (onBack) { onBack(); } else { navigate('/lobby'); } };
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [suggestions, setSuggestions] = useState<EventSuggestion[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UserEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<UserEvent | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [view, setView] = useState<'calendar' | 'upcoming'>('calendar');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (userId) loadMonthEvents();
  }, [currentDate, userId]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/lobby'); return; }

    setUserId(user.id);

    const companions = await getCompanions(user.id);
    for (const companion of companions) {
      try {
        await relationshipCalendarService.backfillRelationshipDays(user.id, companion.id);
      } catch (err) {
        console.error(`Backfill failed for companion ${companion.id}:`, err);
      }
    }

    const [upcoming, sug] = await Promise.all([
      calendarService.getUpcomingEvents(user.id, 14),
      calendarService.getEventSuggestions(user.id),
    ]);

    setUpcomingEvents(upcoming);
    setSuggestions(sug);
    setIsLoading(false);
  };

  const loadMonthEvents = async () => {
    if (!userId) return;
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
    const monthEvents = await calendarService.getUserEvents(userId, start, end);
    setEvents(monthEvents);
  };

  const navigateMonth = (dir: number) => {
    setCurrentDate(prev => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + dir);
      return next;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    const today = new Date();
    setSelectedDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
  };

  const handleSaveEvent = async (eventData: Partial<UserEvent>) => {
    if (eventData.id) {
      await calendarService.updateEvent(eventData.id, eventData);
    } else {
      await calendarService.createEvent({ ...eventData, user_id: userId });
    }
    await loadMonthEvents();
    const upcoming = await calendarService.getUpcomingEvents(userId, 14);
    setUpcomingEvents(upcoming);
    setEditingEvent(null);
  };

  const handleDeleteEvent = async (eventId: string) => {
    await calendarService.deleteEvent(eventId);
    await loadMonthEvents();
    const upcoming = await calendarService.getUpcomingEvents(userId, 14);
    setUpcomingEvents(upcoming);
  };

  const handleToggleComplete = async (eventId: string, completed: boolean) => {
    await calendarService.updateEvent(eventId, { completed } as Partial<UserEvent>);
    await loadMonthEvents();
    const upcoming = await calendarService.getUpcomingEvents(userId, 14);
    setUpcomingEvents(upcoming);
  };

  const handleAcceptSuggestion = async (suggestion: EventSuggestion) => {
    await calendarService.acceptEventSuggestion(suggestion.id, userId);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    await loadMonthEvents();
    const upcoming = await calendarService.getUpcomingEvents(userId, 14);
    setUpcomingEvents(upcoming);
  };

  const handleDismissSuggestion = async (suggestionId: string) => {
    await calendarService.dismissEventSuggestion(suggestionId);
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  };

  const selectedDateEvents = selectedDate
    ? events.filter(e => {
        const d = new Date(e.event_date);
        const eStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return eStr === selectedDate;
      })
    : [];

  const formatSelectedDate = () => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800">
      <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="p-2 hover:bg-white/8 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </button>
            <CalendarDays className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-white text-lg">Calendar</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => {
                setShowEventModal(true);
                setEditingEvent(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-semibold rounded-lg transition-all shadow-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              New Event
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              view === 'calendar'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-300'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </button>
          <button
            onClick={() => setView('upcoming')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              view === 'upcoming'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-300'
            }`}
          >
            Upcoming
            {upcomingEvents.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {upcomingEvents.length}
              </span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {view === 'calendar' ? (
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-white">
                    {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigateMonth(-1)}
                      className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-400" />
                    </button>
                    <button
                      onClick={() => navigateMonth(1)}
                      className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                <CalendarGrid
                  currentDate={currentDate}
                  events={events}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />

                {selectedDate && (
                  <div className="mt-5 pt-5 border-t border-gray-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">{formatSelectedDate()}</h3>
                      <button
                        onClick={() => {
                          setEditingEvent(null);
                          setShowEventModal(true);
                        }}
                        className="text-[11px] text-amber-400 hover:text-amber-300 font-medium transition-colors"
                      >
                        + Add event
                      </button>
                    </div>

                    {selectedDateEvents.length > 0 ? (
                      <div className="space-y-2">
                        {selectedDateEvents.map(event => (
                          <EventCard
                            key={event.id}
                            event={event}
                            onEdit={(e) => { setEditingEvent(e); setShowEventModal(true); }}
                            onDelete={handleDeleteEvent}
                            onToggleComplete={handleToggleComplete}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-6">No events on this day</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5">
                <h2 className="text-lg font-bold text-white mb-4">Upcoming (14 days)</h2>
                {upcomingEvents.length > 0 ? (
                  <div className="space-y-2">
                    {upcomingEvents.map(event => {
                      const d = new Date(event.event_date);
                      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                      return (
                        <div key={event.id}>
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                            {dayLabel}
                          </span>
                          <EventCard
                            event={event}
                            onEdit={(e) => { setEditingEvent(e); setShowEventModal(true); }}
                            onDelete={handleDeleteEvent}
                            onToggleComplete={handleToggleComplete}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No upcoming events in the next 14 days</p>
                    <button
                      onClick={() => { setShowEventModal(true); setEditingEvent(null); }}
                      className="mt-3 text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors"
                    >
                      Create your first event
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-5">
            {suggestions.length > 0 && (
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">AI Suggestions</h3>
                </div>
                <div className="space-y-3">
                  {suggestions.slice(0, 5).map(sug => (
                    <motion.div
                      key={sug.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3"
                    >
                      <h4 className="text-sm font-semibold text-white mb-1">{sug.suggested_title}</h4>
                      <p className="text-[11px] text-gray-400 mb-2 line-clamp-2">{sug.reasoning}</p>
                      {sug.suggested_date && (
                        <span className="text-[10px] text-amber-400/70 block mb-2">
                          {new Date(sug.suggested_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptSuggestion(sug)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-[11px] font-medium transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          Add
                        </button>
                        <button
                          onClick={() => handleDismissSuggestion(sug.id)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-gray-700/50 hover:bg-gray-700 text-gray-400 rounded-lg text-[11px] font-medium transition-colors"
                        >
                          <X className="w-3 h-3" />
                          Dismiss
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-3">Quick Add</h3>
              <div className="space-y-2">
                {[
                  { label: 'Set a reminder', type: 'reminder' },
                  { label: 'Plan a date', type: 'date_idea' },
                  { label: 'Add a birthday', type: 'birthday' },
                  { label: 'Track a goal', type: 'goal_deadline' },
                ].map(item => (
                  <button
                    key={item.type}
                    onClick={() => {
                      setEditingEvent(null);
                      setShowEventModal(true);
                    }}
                    className="w-full text-left px-3 py-2.5 bg-gray-700/30 hover:bg-gray-700/50 border border-gray-700/40 hover:border-gray-600 text-sm text-gray-300 rounded-xl transition-all"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-3">Stats</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-700/30 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-amber-400">{events.length}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">This Month</div>
                </div>
                <div className="bg-gray-700/30 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-400">
                    {events.filter(e => e.completed).length}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Completed</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EventModal
        isOpen={showEventModal}
        onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
        onSave={handleSaveEvent}
        event={editingEvent}
        defaultDate={selectedDate || undefined}
      />
    </div>
  );
}
