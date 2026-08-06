import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Gift, Calendar, Clock, TrendingUp, AlertCircle,
  RefreshCw, Phone, MessageSquare, MapPin, Ticket, Plane,
  Utensils, Music, Sparkles, Check, X, ExternalLink,
  ChevronRight, Users, Loader2, Zap, Activity,
} from 'lucide-react';
import { PageWrapper } from '../shared/ui/PageWrapper';
import {
  relationshipBriefService,
  type RelationshipBrief,
  type BriefOpportunity,
  type ContactLogEntry,
} from '../services/relationshipBriefService';
import type { RealPerson } from '../services/realPeopleService';
import { useNavigate } from 'react-router-dom';

const OPPORTUNITY_ICONS: Record<BriefOpportunity['type'], typeof Gift> = {
  gift: Gift,
  event: Ticket,
  restaurant: Utensils,
  concert: Music,
  travel: Plane,
  experience: Sparkles,
  date_idea: Heart,
};

const SEVERITY_COLORS = {
  urgent: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
  warning: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  info: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
};

const AVATAR_GRADIENTS: Record<string, string> = {
  emerald: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/20',
  sky: 'from-sky-500/20 to-blue-500/20 border-sky-500/20',
  rose: 'from-rose-500/20 to-pink-500/20 border-rose-500/20',
  amber: 'from-amber-500/20 to-orange-500/20 border-amber-500/20',
  violet: 'from-violet-500/20 to-purple-500/20 border-violet-500/20',
  teal: 'from-teal-500/20 to-cyan-500/20 border-teal-500/20',
  cyan: 'from-cyan-500/20 to-sky-500/20 border-cyan-500/20',
  orange: 'from-orange-500/20 to-red-500/20 border-orange-500/20',
};

function healthScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-rose-400';
}

function healthScoreBg(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function RelationshipBriefPage() {
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState<RelationshipBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null);
  const [actionsMap, setActionsMap] = useState<Record<string, Record<number, string>>>({});
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactPerson, setContactPerson] = useState<RealPerson | null>(null);
  const [contactType, setContactType] = useState<ContactLogEntry['contact_type']>('text');
  const [contactNotes, setContactNotes] = useState('');
  const [contactLog, setContactLog] = useState<ContactLogEntry[]>([]);
  const [loadingContactLog, setLoadingContactLog] = useState(false);

  const loadBriefs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await relationshipBriefService.getLatestBriefs();
      setBriefs(data);
      setError(null);

      // Load actions for each brief
      const actions: Record<string, Record<number, string>> = {};
      for (const brief of data) {
        actions[brief.id] = await relationshipBriefService.getActions(brief.id);
      }
      setActionsMap(actions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load briefs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBriefs();
  }, [loadBriefs]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      await relationshipBriefService.generateBriefs();
      await loadBriefs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleAction = async (briefId: string, oppIndex: number, action: 'saved' | 'dismissed' | 'completed') => {
    try {
      await relationshipBriefService.logAction(briefId, oppIndex, action);
      setActionsMap(prev => ({
        ...prev,
        [briefId]: { ...prev[briefId], [oppIndex]: action },
      }));
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  const handleMarkRead = async (briefId: string) => {
    try {
      await relationshipBriefService.markRead(briefId);
      setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, is_read: true } : b));
    } catch (err) {
      console.error('Mark read failed:', err);
    }
  };

  const toggleExpand = (briefId: string) => {
    setExpandedBriefId(prev => {
      const newId = prev === briefId ? null : briefId;
      if (newId !== null) handleMarkRead(briefId);
      return newId;
    });
  };

  const openContactModal = async (person: RealPerson) => {
    setContactPerson(person);
    setShowContactModal(true);
    setContactType('text');
    setContactNotes('');
    try {
      setLoadingContactLog(true);
      const log = await relationshipBriefService.getContactLog(person.id);
      setContactLog(log);
    } catch {
      setContactLog([]);
    } finally {
      setLoadingContactLog(false);
    }
  };

  const handleLogContact = async () => {
    if (!contactPerson) return;
    try {
      await relationshipBriefService.logContact(contactPerson.id, contactType, undefined, contactNotes || undefined);
      const log = await relationshipBriefService.getContactLog(contactPerson.id);
      setContactLog(log);
      setContactType('text');
      setContactNotes('');
      await loadBriefs();
    } catch (err) {
      console.error('Log contact failed:', err);
    }
  };

  const handleDeleteContact = async (entryId: string) => {
    try {
      await relationshipBriefService.deleteContactLog(entryId);
      if (contactPerson) {
        const log = await relationshipBriefService.getContactLog(contactPerson.id);
        setContactLog(log);
      }
      await loadBriefs();
    } catch (err) {
      console.error('Delete contact failed:', err);
    }
  };

  const unreadCount = briefs.filter(b => !b.is_read).length;

  return (
    <PageWrapper maxWidth="lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/20 flex items-center justify-center">
              <Heart className="w-4.5 h-4.5 text-rose-400" />
            </div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Relationship Briefs</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-medium">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="text-sm text-white/40 ml-11.5">
            Proactive opportunities for the people you care about
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm text-white/80 transition-all disabled:opacity-50"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {generating ? 'Generating...' : 'Refresh Briefs'}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-white/30 animate-spin mb-3" />
          <p className="text-sm text-white/30">Loading briefs...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && briefs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-white/30" />
          </div>
          <h3 className="text-white/60 font-medium mb-1">No briefs yet</h3>
          <p className="text-sm text-white/30 max-w-sm mb-4">
            Add people to your People list, then generate briefs to discover personalized opportunities for gifts, events, and experiences they'll love.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/navi')}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/70 transition-all"
            >
              Go to People
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 rounded-xl text-sm text-emerald-300 transition-all disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              Generate Now
            </button>
          </div>
        </div>
      )}

      {/* Brief cards */}
      {!loading && briefs.length > 0 && (
        <div className="space-y-3">
          {briefs.map((brief, idx) => {
            const person = brief.person;
            if (!person) return null;
            const avatarGradient = AVATAR_GRADIENTS[person.avatar_color] || AVATAR_GRADIENTS.emerald;
            const isExpanded = expandedBriefId === brief.id;
            const actions = actionsMap[brief.id] || {};

            return (
              <motion.div
                key={brief.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className={`rounded-2xl border overflow-hidden transition-all ${
                  isExpanded
                    ? 'bg-white/6 border-white/15'
                    : 'bg-white/4 border-white/8 hover:bg-white/6 hover:border-white/12'
                }`}
              >
                {/* Brief header (always visible) */}
                <button
                  onClick={() => toggleExpand(brief.id)}
                  className="w-full p-4 flex items-center gap-3 text-left"
                >
                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarGradient} border flex items-center justify-center flex-shrink-0`}>
                    <Heart className="w-5 h-5 text-white/70" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-white truncate">{person.name}</span>
                      {!brief.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-white/40 truncate capitalize">
                      {person.relationship}
                      {person.city ? ` \u00b7 ${person.city}` : ''}
                    </p>
                  </div>

                  {/* Health score */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1">
                        <Activity className={`w-3 h-3 ${healthScoreColor(brief.health_score)}`} />
                        <span className={`text-xs font-semibold ${healthScoreColor(brief.health_score)}`}>
                          {brief.health_score}
                        </span>
                      </div>
                      <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden mt-0.5">
                        <div
                          className={`h-full ${healthScoreBg(brief.health_score)} transition-all`}
                          style={{ width: `${brief.health_score}%` }}
                        />
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {/* Expandable content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-4">
                        {/* Divider */}
                        <div className="border-t border-white/8" />

                        {/* Summary */}
                        <p className="text-sm text-white/70 leading-relaxed">
                          {brief.brief_summary}
                        </p>

                        {/* Insights */}
                        {brief.insights.length > 0 && (
                          <div className="space-y-2">
                            {brief.insights.map((insight, i) => (
                              <div
                                key={i}
                                className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs ${SEVERITY_COLORS[insight.severity]}`}
                              >
                                {insight.severity === 'urgent' ? (
                                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                ) : insight.severity === 'warning' ? (
                                  <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                )}
                                <span className="leading-relaxed">{insight.text}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white/4 rounded-xl p-2.5 border border-white/6">
                            <div className="flex items-center gap-1 text-white/30 mb-0.5">
                              <Clock className="w-3 h-3" />
                              <span className="text-[10px] uppercase tracking-wide">Contact Gap</span>
                            </div>
                            <span className="text-sm font-semibold text-white">
                              {brief.contact_gap_days >= 999 ? 'Never' : `${brief.contact_gap_days}d`}
                            </span>
                          </div>
                          <div className="bg-white/4 rounded-xl p-2.5 border border-white/6">
                            <div className="flex items-center gap-1 text-white/30 mb-0.5">
                              <Calendar className="w-3 h-3" />
                              <span className="text-[10px] uppercase tracking-wide">Next Event</span>
                            </div>
                            <span className="text-sm font-semibold text-white">
                              {brief.upcoming_event_type === 'none'
                                ? 'None soon'
                                : brief.days_until_event !== null
                                  ? `${brief.days_until_event}d`
                                  : 'N/A'}
                            </span>
                          </div>
                          <div className="bg-white/4 rounded-xl p-2.5 border border-white/6">
                            <div className="flex items-center gap-1 text-white/30 mb-0.5">
                              <Sparkles className="w-3 h-3" />
                              <span className="text-[10px] uppercase tracking-wide">Opportunities</span>
                            </div>
                            <span className="text-sm font-semibold text-white">{brief.opportunities.length}</span>
                          </div>
                        </div>

                        {/* Opportunities */}
                        {brief.opportunities.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wide flex items-center gap-1.5">
                              <Gift className="w-3.5 h-3.5" />
                              Opportunities for {person.name}
                            </h4>
                            {brief.opportunities.map((opp, i) => {
                              const Icon = OPPORTUNITY_ICONS[opp.type] || Sparkles;
                              const action = actions[i];
                              return (
                                <div
                                  key={i}
                                  className={`rounded-xl border p-3 transition-all ${
                                    action === 'dismissed'
                                      ? 'bg-white/2 border-white/5 opacity-40'
                                      : action === 'completed'
                                        ? 'bg-emerald-500/8 border-emerald-500/15'
                                        : 'bg-white/4 border-white/8'
                                  }`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-white/6 flex items-center justify-center flex-shrink-0">
                                      <Icon className="w-3.5 h-3.5 text-white/50" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <a
                                        href={opp.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-medium text-white/80 hover:text-white line-clamp-2 inline-flex items-start gap-1"
                                      >
                                        {opp.title}
                                        {opp.url && <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5 text-white/30" />}
                                      </a>
                                      {opp.description && (
                                        <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{opp.description}</p>
                                      )}
                                      <p className="text-[10px] text-white/25 mt-1 italic">{opp.relevance}</p>

                                      {/* Action buttons */}
                                      {!action && (
                                        <div className="flex gap-1.5 mt-2">
                                          <button
                                            onClick={() => handleAction(brief.id, i, 'saved')}
                                            className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-white/50 transition-all"
                                          >
                                            <Check className="w-3 h-3" /> Save
                                          </button>
                                          <button
                                            onClick={() => handleAction(brief.id, i, 'completed')}
                                            className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg text-[10px] text-emerald-300 transition-all"
                                          >
                                            <Check className="w-3 h-3" /> Done
                                          </button>
                                          <button
                                            onClick={() => handleAction(brief.id, i, 'dismissed')}
                                            className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-white/30 transition-all"
                                          >
                                            <X className="w-3 h-3" /> Dismiss
                                          </button>
                                        </div>
                                      )}
                                      {action && (
                                        <span className={`inline-flex items-center gap-1 mt-2 text-[10px] ${
                                          action === 'completed' ? 'text-emerald-300' : 'text-white/30'
                                        }`}>
                                          {action === 'completed' && <Check className="w-3 h-3" />}
                                          {action === 'saved' && 'Saved'}
                                          {action === 'completed' && 'Completed'}
                                          {action === 'dismissed' && 'Dismissed'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Action bar */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => openContactModal(person)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-white/60 transition-all"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            Log Contact
                          </button>
                          <button
                            onClick={() => navigate(`/person/${person.id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-white/60 transition-all"
                          >
                            <Users className="w-3.5 h-3.5" />
                            View Profile
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Contact log modal */}
      <AnimatePresence>
        {showContactModal && contactPerson && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowContactModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-2xl p-5 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Log Contact with {contactPerson.name}</h3>
                <button
                  onClick={() => setShowContactModal(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>

              {/* Contact type selector */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(['call', 'text', 'visit'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setContactType(type)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                      contactType === type
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                        : 'bg-white/5 text-white/40 border border-white/8'
                    }`}
                  >
                    {type === 'call' && <Phone className="w-3 h-3 inline mr-1" />}
                    {type === 'text' && <MessageSquare className="w-3 h-3 inline mr-1" />}
                    {type === 'visit' && <MapPin className="w-3 h-3 inline mr-1" />}
                    {type}
                  </button>
                ))}
                {(['gift', 'social_media', 'other'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setContactType(type)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all ${
                      contactType === type
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                        : 'bg-white/5 text-white/40 border border-white/8'
                    }`}
                  >
                    {type === 'gift' && <Gift className="w-3 h-3 inline mr-1" />}
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Notes */}
              <textarea
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                placeholder="Optional notes about the interaction..."
                className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-white/20 mb-3"
                rows={2}
              />

              <button
                onClick={handleLogContact}
                className="w-full py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 rounded-xl text-sm text-emerald-300 font-medium transition-all mb-4"
              >
                Log Contact
              </button>

              {/* Contact history */}
              <div>
                <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2">History</h4>
                {loadingContactLog ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
                  </div>
                ) : contactLog.length === 0 ? (
                  <p className="text-xs text-white/25 text-center py-3">No contact logged yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {contactLog.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 p-2 bg-white/4 rounded-lg text-xs"
                      >
                        <span className="text-white/50 capitalize">{entry.contact_type.replace('_', ' ')}</span>
                        <span className="text-white/30">{formatDate(entry.contact_date)}</span>
                        {entry.notes && <span className="text-white/30 truncate flex-1">\u2014 {entry.notes}</span>}
                        <button
                          onClick={() => handleDeleteContact(entry.id)}
                          className="p-0.5 hover:bg-white/10 rounded transition-colors ml-auto"
                        >
                          <X className="w-3 h-3 text-white/30" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageWrapper>
  );
}
