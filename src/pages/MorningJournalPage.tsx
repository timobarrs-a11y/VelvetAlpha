import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sunrise, ArrowRight, ArrowLeft, Sparkles, BookOpen, Calendar, Loader2 } from 'lucide-react';
import { PageHeader } from '../shared/ui/PageHeader';
import { LoadingState } from '../shared/ui/LoadingState';
import { journalService, type JournalSessionWithQA } from '../services/journalService';

type Phase = 'loading' | 'questions' | 'ratings' | 'generating' | 'revealed' | 'history';

export function MorningJournalPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('loading');
  const [session, setSession] = useState<JournalSessionWithQA | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [mood, setMood] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [focus, setFocus] = useState(5);
  const [journalEntry, setJournalEntry] = useState('');
  const [genError, setGenError] = useState<string | null>(null);
  const [history, setHistory] = useState<JournalSessionWithQA[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const answerInputRef = useRef<HTMLTextAreaElement>(null);

  const loadSession = useCallback(async () => {
    try {
      const s = await journalService.getTodaySessionWithQA();
      if (!s) {
        setPhase('questions');
        return;
      }

      setSession(s);

      if (s.journal_entry) {
        setJournalEntry(s.journal_entry);
        setMood(s.mood_rating || 5);
        setEnergy(s.energy_rating || 5);
        setFocus(s.focus_rating || 5);
        setPhase('revealed');
      } else if (s.phase === 'ratings') {
        setMood(s.mood_rating || 5);
        setEnergy(s.energy_rating || 5);
        setFocus(s.focus_rating || 5);
        setPhase('ratings');
      } else {
        const unanswered = s.qa_pairs.findIndex(qa => !qa.answer);
        if (unanswered >= 0) {
          setCurrentQIndex(unanswered);
        } else {
          setPhase('ratings');
        }
      }
    } catch {
      setPhase('questions');
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (phase === 'questions' && answerInputRef.current) {
      answerInputRef.current.focus();
    }
  }, [phase, currentQIndex]);

  const handleStartJournal = async () => {
    try {
      const s = await journalService.getTodaySessionWithQA();
      if (s && s.qa_pairs.length === 0) {
        const { getQuestionsForSession } = await import('../services/journalService');
        const questions = getQuestionsForSession();
        await journalService.createQAEntries(s.id, questions);
        const updated = await journalService.getSessionWithQA(s.id);
        if (updated) {
          setSession(updated);
          setCurrentQIndex(0);
        }
      } else if (s) {
        setSession(s);
        const unanswered = s.qa_pairs.findIndex(qa => !qa.answer);
        setCurrentQIndex(unanswered >= 0 ? unanswered : 0);
      }
      setPhase('questions');
    } catch {
      setPhase('questions');
    }
  };

  const handleAnswer = async () => {
    if (!session || !currentAnswer.trim()) return;

    const qa = session.qa_pairs[currentQIndex];
    if (!qa) return;

    try {
      await journalService.answerQuestion(qa.id, currentAnswer.trim());
      const updated = await journalService.getSessionWithQA(session.id);
      if (!updated) return;
      setSession(updated);
      setCurrentAnswer('');

      if (currentQIndex < updated.qa_pairs.length - 1) {
        setCurrentQIndex(currentQIndex + 1);
      } else {
        setPhase('ratings');
      }
    } catch (err) {
      console.error('Failed to save answer:', err);
    }
  };

  const handleRatingsSubmit = async () => {
    if (!session) return;
    try {
      await journalService.saveRatings(session.id, { mood, energy, focus });
      setPhase('generating');
      const entry = await journalService.generateJournalEntry(session.id);
      setJournalEntry(entry);
      setPhase('revealed');
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Something went wrong');
      setPhase('ratings');
    }
  };

  const loadHistory = async () => {
    try {
      const h = await journalService.getSessionHistory(15);
      setHistory(h);
      setShowHistory(true);
    } catch {
      setHistory([]);
      setShowHistory(true);
    }
  };

  if (phase === 'loading') {
    return <LoadingState label="Loading your journal..." />;
  }

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="ds-page min-h-screen">
      <PageHeader
        title="Morning Journal"
        icon={Sunrise}
        accent="#fbbf24"
        actions={
          <button
            onClick={loadHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs transition-all"
          >
            <Calendar className="w-3.5 h-3.5" />
            History
          </button>
        }
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome / Start Screen */}
        {phase === 'questions' && !session && (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
              <Sunrise className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Good morning</h1>
            <p className="text-white/50 text-sm max-w-md leading-relaxed mb-1">
              Take a few minutes to check in with yourself before the day takes over.
            </p>
            <p className="text-white/30 text-xs max-w-md leading-relaxed mb-8">
              {todayLabel} — a few questions, a quick mood check, and a journal entry written in your voice.
            </p>
            <button
              onClick={handleStartJournal}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 hover:bg-amber-500/25 transition-all font-medium text-sm"
            >
              Begin Journal
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Questions Phase */}
        {phase === 'questions' && session && (
          <div>
            {/* Progress dots */}
            <div className="flex items-center gap-1.5 mb-8 justify-center">
              {session.qa_pairs.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i < currentQIndex ? 'w-6 bg-amber-500' :
                    i === currentQIndex ? 'w-8 bg-amber-400' :
                    'w-2 bg-white/10'
                  }`}
                />
              ))}
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 sm:p-8 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                  <span className="text-amber-400 text-xs font-semibold">{currentQIndex + 1}</span>
                </div>
                <span className="text-white/30 text-xs">Question {currentQIndex + 1} of {session.qa_pairs.length}</span>
              </div>

              <p className="text-white/90 text-lg font-medium leading-relaxed mb-6">
                {session.qa_pairs[currentQIndex]?.question}
              </p>

              <textarea
                ref={answerInputRef}
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleAnswer();
                  }
                }}
                placeholder="Type your answer..."
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-4 text-white/85 text-sm leading-relaxed placeholder:text-white/20 focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.06] transition-all resize-none"
                rows={4}
              />

              <div className="flex items-center justify-between mt-4">
                <span className="text-white/20 text-xs">{currentAnswer.length} chars</span>
                <button
                  onClick={handleAnswer}
                  disabled={!currentAnswer.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-200 text-sm font-medium hover:bg-amber-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {currentQIndex < session.qa_pairs.length - 1 ? 'Next' : 'Continue to Ratings'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {currentQIndex > 0 && (
              <button
                onClick={() => {
                  setCurrentQIndex(currentQIndex - 1);
                  const prev = session.qa_pairs[currentQIndex - 1];
                  setCurrentAnswer(prev.answer || '');
                }}
                className="flex items-center gap-1.5 text-white/30 hover:text-white/50 text-xs transition-colors mx-auto"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to previous question
              </button>
            )}
          </div>
        )}

        {/* Ratings Phase */}
        {phase === 'ratings' && (
          <div>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Quick check-in</h2>
              <p className="text-white/40 text-sm">How are you showing up today?</p>
            </div>

            <div className="space-y-5 mb-8">
              <RatingSlider label="Mood" value={mood} onChange={setMood} color="amber" />
              <RatingSlider label="Energy" value={energy} onChange={setEnergy} color="emerald" />
              <RatingSlider label="Focus" value={focus} onChange={setFocus} color="sky" />
            </div>

            {genError && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-red-300/70 text-xs">
                {genError}
              </div>
            )}

            <button
              onClick={handleRatingsSubmit}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 hover:bg-amber-500/25 transition-all font-medium text-sm"
            >
              Generate My Journal Entry
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Generating Phase */}
        {phase === 'generating' && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative mb-6">
              <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
            </div>
            <p className="text-white/60 text-sm font-medium mb-1">Writing your journal entry...</p>
            <p className="text-white/30 text-xs">Weaving your answers into a reflection</p>
          </div>
        )}

        {/* Revealed Phase */}
        {phase === 'revealed' && journalEntry && (
          <div>
            <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.06] to-orange-500/[0.03] p-6 sm:p-8 mb-6">
              <div className="flex items-center gap-2 mb-5">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">{todayLabel}</h2>
              </div>

              <div className="prose prose-invert max-w-none">
                {journalEntry.split('\n').map((line, i) => (
                  <p key={i} className="text-white/80 text-sm leading-relaxed mb-3 last:mb-0">
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {/* Rating summary */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Mood', value: mood, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                { label: 'Energy', value: energy, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                { label: 'Focus', value: focus, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
              ].map(r => (
                <div key={r.label} className={`rounded-xl p-3 border ${r.bg} text-center`}>
                  <div className={`text-lg font-bold ${r.color}`}>{r.value}</div>
                  <div className="text-white/40 text-xs">{r.label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => navigate('/insights')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs transition-all"
              >
                View Insights
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={loadHistory}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs transition-all"
              >
                <Calendar className="w-3.5 h-3.5" />
                Past Entries
              </button>
            </div>
          </div>
        )}

        {/* History View */}
        {showHistory && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowHistory(false)}>
            <div className="bg-[#0d1424] border border-white/10 rounded-2xl max-w-2xl w-full mt-8 p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">Journal History</h2>
                <button onClick={() => setShowHistory(false)} className="text-white/40 hover:text-white text-sm">Close</button>
              </div>
              {history.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-8">No past journal entries yet.</p>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  {history.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-3.5 h-3.5 text-amber-400/70" />
                        <span className="text-white/60 text-xs font-medium">
                          {new Date(entry.session_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-white/70 text-sm leading-relaxed line-clamp-4">{entry.journal_entry}</p>
                      <div className="flex gap-2 mt-3">
                        {entry.mood_rating && <span className="text-xs text-amber-400/60">Mood: {entry.mood_rating}</span>}
                        {entry.energy_rating && <span className="text-xs text-emerald-400/60">Energy: {entry.energy_rating}</span>}
                        {entry.focus_rating && <span className="text-xs text-sky-400/60">Focus: {entry.focus_rating}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RatingSlider({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: 'amber' | 'emerald' | 'sky';
}) {
  const colorMap = {
    amber: { text: 'text-amber-400', bg: 'bg-amber-500', track: 'bg-amber-500/15' },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500', track: 'bg-emerald-500/15' },
    sky: { text: 'text-sky-400', bg: 'bg-sky-500', track: 'bg-sky-500/15' },
  };
  const c = colorMap[color];

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/70 text-sm font-medium">{label}</span>
        <span className={`text-lg font-bold ${c.text}`}>{value}<span className="text-white/20 text-sm font-normal">/10</span></span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-white/20 text-xs w-8 text-right">1</span>
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-amber-500"
          style={{
            background: `linear-gradient(to right, ${c.bg} 0%, ${c.bg} ${(value - 1) / 9 * 100}%, rgba(255,255,255,0.08) ${(value - 1) / 9 * 100}%, rgba(255,255,255,0.08) 100%)`,
          }}
        />
        <span className="text-white/20 text-xs w-8">10</span>
      </div>
    </div>
  );
}
