import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Trash2, Link as LinkIcon, Check, Loader2,
  ChevronRight, Heart,
} from 'lucide-react';
import {
  realPeopleService,
  RealPerson,
} from '../services/realPeopleService';

const AVATAR_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300' },
  sky: { bg: 'bg-sky-500/15', border: 'border-sky-500/30', text: 'text-sky-300' },
  rose: { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-300' },
  amber: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-300' },
  violet: { bg: 'bg-violet-500/15', border: 'border-violet-500/30', text: 'text-violet-300' },
  teal: { bg: 'bg-teal-500/15', border: 'border-teal-500/30', text: 'text-teal-300' },
  cyan: { bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', text: 'text-cyan-300' },
  orange: { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-300' },
};

function getAvatarStyle(color: string) {
  return AVATAR_STYLES[color] || AVATAR_STYLES.emerald;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function AddPersonModal({
  onSave,
  onClose,
}: {
  onSave: (name: string, relationship: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('friend');

  const relationships = [
    'girlfriend', 'boyfriend', 'partner', 'wife', 'husband',
    'mom', 'dad', 'sister', 'brother', 'friend', 'best friend',
    'coworker', 'boss', 'neighbor', 'other',
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="bg-[#111218] border border-white/10 rounded-2xl p-6 max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Add a person</h3>
            <p className="text-white/40 text-xs mt-0.5">You can fill in details later or send them a survey link</p>
          </div>
        </div>

        <label className="block text-xs text-white/40 font-medium mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim(), relationship)}
          placeholder="e.g. Sarah"
          autoFocus
          className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/40 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none transition-colors mb-4"
        />

        <label className="block text-xs text-white/40 font-medium mb-1.5">Relationship</label>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {relationships.map(rel => (
            <button
              key={rel}
              onClick={() => setRelationship(rel)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all capitalize ${
                relationship === rel
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
              }`}
            >
              {rel}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white/70 rounded-xl text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onSave(name.trim(), relationship)}
            disabled={!name.trim()}
            className="flex-1 px-4 py-2.5 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ShareLinkModal({
  person,
  onClose,
}: {
  person: RealPerson;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const existingTokens = await realPeopleService.getSurveyTokens(person.id);
        if (existingTokens.length > 0) {
          setToken(existingTokens[0]);
        } else {
          const newToken = await realPeopleService.createSurveyToken(person.id);
          setToken(newToken);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate link');
      } finally {
        setLoading(false);
      }
    })();
  }, [person.id]);

  const surveyUrl = token ? realPeopleService.buildSurveyUrl(token) : '';

  const handleCopy = async () => {
    if (!surveyUrl) return;
    try {
      await navigator.clipboard.writeText(surveyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = surveyUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!surveyUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Help me get to know you, ${person.name}`,
          text: `Fill out this quick survey so I can find things you'll love!`,
          url: surveyUrl,
        });
      } catch {
        // user cancelled share, no action needed
      }
    } else {
      handleCopy();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="bg-[#111218] border border-white/10 rounded-2xl p-6 max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <LinkIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Survey link for {person.name}</h3>
            <p className="text-white/40 text-xs mt-0.5">Send this to them — no account needed</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-400/80 py-4">{error}</p>
        ) : (
          <>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4">
              <p className="text-xs text-white/40 mb-1">Shareable link:</p>
              <p className="text-xs text-emerald-300/80 break-all font-mono">{surveyUrl}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  copied
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-white/8 hover:bg-white/14 border-white/12 text-white'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-all"
              >
                Share
              </button>
            </div>

            <p className="text-xs text-white/30 mt-4 text-center leading-relaxed">
              {person.survey_completed
                ? `${person.name} has already filled this out — they can update it anytime.`
                : `When ${person.name} fills this out, their preferences will appear here automatically.`}
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export interface PeoplePanelProps {
  onSelectPerson: (person: RealPerson | null) => void;
  selectedPersonId: string | null;
  onNavigateToProfile: (personId: string) => void;
}

export function PeoplePanel({ onSelectPerson, selectedPersonId, onNavigateToProfile }: PeoplePanelProps) {
  const [people, setPeople] = useState<RealPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sharePerson, setSharePerson] = useState<RealPerson | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const loadPeople = useCallback(async () => {
    try {
      const data = await realPeopleService.getAll();
      setPeople(data);
    } catch (err) {
      console.error('Failed to load people', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const handleAddPerson = async (name: string, relationship: string) => {
    try {
      const person = await realPeopleService.create(name, relationship);
      setPeople(prev => [person, ...prev]);
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add person', err);
    }
  };

  const handleDeletePerson = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await realPeopleService.remove(id);
      setPeople(prev => prev.filter(p => p.id !== id));
      if (selectedPersonId === id) onSelectPerson(null);
    } catch (err) {
      console.error('Failed to delete person', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">People</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 text-[10px] text-emerald-400/70 hover:text-emerald-400 transition-colors font-medium"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-white/20 animate-spin" />
          </div>
        ) : people.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Users className="w-7 h-7 text-white/15 mb-2.5" />
            <p className="text-white/35 text-sm font-medium">No people yet</p>
            <p className="text-white/20 text-xs mt-1 leading-relaxed">
              Add someone to find gifts and events they will love
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 flex items-center gap-1.5 px-3 py-2 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl text-xs font-medium text-emerald-300 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add a person
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {people.map(person => {
              const style = getAvatarStyle(person.avatar_color);
              const isSelected = selectedPersonId === person.id;
              const completionPct = person.survey_completed ? 100 : Math.round(getCompletionPercent(person));

              return (
                <div
                  key={person.id}
                  className={`group relative rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-white/3 hover:bg-white/6 border-transparent hover:border-white/8'
                  }`}
                >
                  <button
                    onClick={() => onSelectPerson(isSelected ? null : person)}
                    className="w-full text-left px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg ${style.bg} ${style.border} border flex items-center justify-center flex-shrink-0`}>
                        <span className={`text-xs font-bold ${style.text}`}>{getInitials(person.name)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white/85 truncate leading-tight">{person.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-white/35 capitalize">{person.relationship}</span>
                          {person.survey_completed ? (
                            <span className="text-[9px] text-emerald-400/60 flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" />
                              survey done
                            </span>
                          ) : completionPct > 0 ? (
                            <span className="text-[9px] text-white/25">{completionPct}% filled</span>
                          ) : (
                            <span className="text-[9px] text-white/20">no details yet</span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* Action buttons (shown on hover or when selected) */}
                  <div className={`flex items-center gap-0.5 px-2 pb-2 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    <button
                      onClick={e => { e.stopPropagation(); setSharePerson(person); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                    >
                      <LinkIcon className="w-3 h-3" />
                      Survey link
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); onNavigateToProfile(person.id); }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-white/40 hover:text-white/80 hover:bg-white/8 transition-all"
                    >
                      <ChevronRight className="w-3 h-3" />
                      Details
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setPendingDeleteId(person.id); }}
                      className="ml-auto p-1 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Briefs link */}
      {people.length > 0 && (
        <div className="flex-shrink-0 px-3 py-2 border-t border-white/6">
          <button
            onClick={() => onNavigateToProfile('__briefs__')}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500/8 hover:bg-rose-500/15 border border-rose-500/15 hover:border-rose-500/30 rounded-xl text-xs text-rose-300/80 hover:text-rose-300 transition-all"
          >
            <Heart className="w-3.5 h-3.5" />
            Relationship Briefs
          </button>
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <AddPersonModal onSave={handleAddPerson} onClose={() => setShowAddModal(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sharePerson && (
          <ShareLinkModal person={sharePerson} onClose={() => setSharePerson(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setPendingDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-[#111218] border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-white font-semibold mb-2">Remove this person?</p>
              <p className="text-white/40 text-sm mb-6">All their preferences and survey data will be deleted.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className="flex-1 px-4 py-2.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white/70 rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeletePerson}
                  className="flex-1 px-4 py-2.5 bg-red-500/80 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getCompletionPercent(person: RealPerson): number {
  const fields: (keyof RealPerson)[] = [
    'birthday', 'city', 'favorite_color', 'hobbies',
    'favorite_foods', 'movie_genres', 'sports_teams',
    'music_genres', 'travel_destinations',
  ];
  let filled = 0;
  for (const field of fields) {
    const val = person[field];
    if (Array.isArray(val) && val.length > 0) filled++;
    else if (typeof val === 'string' && val.trim()) filled++;
  }
  return (filled / fields.length) * 100;
}

export { getCompletionPercent, getAvatarStyle, getInitials };
