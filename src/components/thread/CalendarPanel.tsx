import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Calendar,
  Check,
  Sparkles,
  Loader,
  Gift,
} from 'lucide-react';
import { supabase } from '../../shared/supabase/client';
import { calendarService, UserEvent, EventSuggestion, GiftSuggestion } from '../../services/calendarService';
import { getCompanions, CompanionWithLastMessage } from '../../services/companionService';
import { CalendarGrid } from '../calendar/CalendarGrid';
import { EventCard } from '../calendar/EventCard';
import { EventModal } from '../calendar/EventModal';
import { CalendarNaviPanel } from '../CalendarNaviPanel';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface CalendarPanelProps {
  onClose: () => void;
}

export function CalendarPanel({ onClose }: CalendarPanelProps) {
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
  const [companions, setCompanions] = useState<CompanionWithLastMessage[]>([]);
  const [selectedCompanionId, setSelectedCompanionId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [gifts, setGifts] = useState<GiftSuggestion[]>([]);

  useEffect(() => {
    loadData();
    const today = new Date();
    setSelectedDate(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    );
  }, []);

  useEffect(() => {
    if (userId) loadMonthEvents();
  }, [currentDate, userId]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [upcoming, sug, companionList, giftList] = await Promise.all([
      calendarService.getUpcomingEvents(user.id, 14),
      calendarService.getEventSuggestions(user.id),
      getCompanions(user.id),
      calendarService.getGiftSuggestions(user.id),
    ]);

    setUpcomingEvents(upcoming);
    setSuggestions(sug);
    setCompanions(companionList);
    if (companionList.length > 0) setSelectedCompanionId(companionList[0].id);
    setGifts(giftList);
    setIsLoading(false);
  };

  const loadMonthEvents = async () => {
    if (!userId) return;
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
    const monthEvents = await calendarService.getUserEvents(userId, start, end);
    setEvents(monthEvents);
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

  const handleGenerateSuggestions = async () => {
    if (!userId || !selectedCompanionId) return;
    setIsGenerating(true);
    try {
      const result = await calendarService.generateEventSuggestions(userId, selectedCompanionId);
      if (result && result.suggested >= 0) {
        const fresh = await calendarService.getEventSuggestions(userId);
        setSuggestions(fresh);
      }
    } catch {
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGiftReaction = async (giftId: string, reaction: 'loved_it' | 'considering' | 'not_interested' | 'purchased') => {
    await calendarService.updateGiftReaction(giftId, reaction);
    setGifts(prev => prev.filter(g => g.id !== giftId));
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

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-amber-400" />
            <CalendarDays className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-white text-lg">Calendar</span>
          </div>
          <div className="flex items-center gap-2">
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
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-5">
                <button
                  onClick={() => setView('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    view === 'calendar'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:text-gray-300'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Calendar
                </button>
                <button
                  onClick={() => setView('upcoming')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    view === 'upcoming'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:text-gray-300'
                  }`}
                >
                  Upcoming
                  {upcomingEvents.length > 0 && (
                    <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {upcomingEvents.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  {view === 'calendar' ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-white">
                          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </h2>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const next = new Date(currentDate);
                              next.setMonth(next.getMonth() - 1);
                              setCurrentDate(next);
                            }}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => {
                              const next = new Date(currentDate);
                              next.setMonth(next.getMonth() + 1);
                              setCurrentDate(next);
                            }}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </div>
                      <CalendarGrid
                        currentDate={currentDate}
                        events={events}
                        selectedDate={selectedDate}
                        onSelectDate={setSelectedDate}
                      />
                    </div>
                  ) : (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <h2 className="text-sm font-bold text-white mb-3">Next 14 Days</h2>
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
                        <div className="text-center py-8">
                          <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                          <p className="text-gray-400 text-sm">No upcoming events</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {selectedDate && view === 'calendar' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-white">{formatSelectedDate()}</h3>
                        <button
                          onClick={() => { setEditingEvent(null); setShowEventModal(true); }}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-medium"
                        >
                          + Add
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
                        <p className="text-xs text-gray-500 text-center py-4">No events on this day</p>
                      )}
                    </div>
                  )}

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <h3 className="text-xs font-bold text-white">AI Suggestions</h3>
                    </div>
                    {companions.length > 0 && (
                      <div className="mb-3 space-y-2">
                        <select
                          value={selectedCompanionId}
                          onChange={(e) => setSelectedCompanionId(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500/50"
                        >
                          {companions.map(c => (
                            <option key={c.id} value={c.id}>{c.custom_name}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleGenerateSuggestions}
                          disabled={isGenerating || !selectedCompanionId}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all"
                        >
                          {isGenerating ? (
                            <Loader className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          Generate Event Ideas
                        </button>
                      </div>
                    )}
                    {suggestions.length > 0 ? (
                      <div className="space-y-2">
                        {suggestions.slice(0, 3).map(sug => (
                          <div
                            key={sug.id}
                            className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3"
                          >
                            <h4 className="text-xs font-semibold text-white mb-1">{sug.suggested_title}</h4>
                            <p className="text-[10px] text-gray-400 mb-2 line-clamp-2">{sug.reasoning}</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAcceptSuggestion(sug)}
                                className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-[10px] font-medium transition-colors"
                              >
                                <Check className="w-3 h-3" />
                                Add
                              </button>
                              <button
                                onClick={() => handleDismissSuggestion(sug.id)}
                                className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-[10px] font-medium transition-colors"
                              >
                                <X className="w-3 h-3" />
                                Dismiss
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-500 text-center py-3">
                        No suggestions yet. Generate some from your conversations.
                      </p>
                    )}
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Gift className="w-3.5 h-3.5 text-rose-400" />
                      <h3 className="text-xs font-bold text-white">Gift Ideas</h3>
                    </div>
                    {gifts.length > 0 ? (
                      <div className="space-y-2">
                        {gifts.slice(0, 3).map(gift => (
                          <div
                            key={gift.id}
                            className="bg-rose-500/5 border border-rose-500/15 rounded-xl p-3"
                          >
                            <h4 className="text-xs font-semibold text-white mb-1">{gift.gift_idea}</h4>
                            <p className="text-[10px] text-gray-400 mb-1 line-clamp-2">{gift.reasoning}</p>
                            <p className="text-[10px] text-gray-500 mb-2">{gift.where_to_buy}</p>
                            <div className="flex gap-1.5 flex-wrap">
                              <button
                                onClick={() => handleGiftReaction(gift.id, 'loved_it')}
                                className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-[9px] font-medium transition-colors"
                              >
                                Love it
                              </button>
                              <button
                                onClick={() => handleGiftReaction(gift.id, 'purchased')}
                                className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-[9px] font-medium transition-colors"
                              >
                                Purchased
                              </button>
                              <button
                                onClick={() => handleGiftReaction(gift.id, 'not_interested')}
                                className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-[9px] font-medium transition-colors"
                              >
                                No thanks
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-500 text-center py-3">
                        No gift ideas yet. Generate some from the full calendar page.
                      </p>
                    )}
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <h3 className="text-xs font-bold text-white mb-3">Quick Add</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Reminder', type: 'reminder' },
                        { label: 'Date idea', type: 'date_idea' },
                        { label: 'Birthday', type: 'birthday' },
                        { label: 'Goal', type: 'goal_deadline' },
                      ].map(item => (
                        <button
                          key={item.type}
                          onClick={() => { setEditingEvent(null); setShowEventModal(true); }}
                          className="text-left px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 rounded-xl transition-all"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {userId && (
                    <CalendarNaviPanel
                      userId={userId}
                      upcomingEvents={upcomingEvents}
                      onEventAdded={async () => {
                        await loadMonthEvents();
                        const upcoming = await calendarService.getUpcomingEvents(userId, 14);
                        setUpcomingEvents(upcoming);
                      }}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <EventModal
        isOpen={showEventModal}
        onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
        onSave={handleSaveEvent}
        event={editingEvent}
        defaultDate={selectedDate || undefined}
      />
    </>
  );
}
