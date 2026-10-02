import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain, Check, X, AlertTriangle, RefreshCw, Sparkles, Trophy,
  MessageCircle, Eye, Edit3, ChevronRight, Lightbulb, Target,
} from 'lucide-react';
import { PageHeader } from '../shared/ui';
import { supabase } from '../shared/supabase/client';

interface Scenario {
  id: string;
  title: string;
  category: string;
  prompt: string;
  context_lines: string[];
  difficulty: string;
  expected_facts: Array<{ field: string; value: string }>;
  sort_order: number;
}

interface ExtractionResponse {
  extraction_id: string;
  extracted_json: Record<string, unknown>;
  extracted_text: string;
}

type Phase = 'picker' | 'roleplay' | 'extracting' | 'review' | 'done';

const CATEGORY_COLORS: Record<string, string> = {
  work: 'blue',
  relationships: 'rose',
  health: 'emerald',
  hobbies: 'amber',
  life: 'purple',
  general: 'slate',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'emerald',
  medium: 'amber',
  hard: 'red',
};

export default function MemoryTrainingPage() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>('picker');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [responseText, setResponseText] = useState('');
  const [extraction, setExtraction] = useState<ExtractionResponse | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<'confirmed' | 'corrected' | 'rejected' | null>(null);
  const [correctedText, setCorrectedText] = useState('');

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    loadScenarios();
    loadCompletedCount();
  }, []);

  const loadScenarios = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('eval_scenarios')
      .select('id, title, category, prompt, context_lines, difficulty, expected_facts, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setScenarios(data || []);
    setLoading(false);
  };

  const loadCompletedCount = async () => {
    const { count, error: err } = await supabase
      .from('eval_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '');

    if (!err && count !== null) {
      setCompletedCount(count);
    }
  };

  const startScenario = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setResponseText('');
    setExtraction(null);
    setVerificationStatus(null);
    setCorrectedText('');
    setPhase('roleplay');
  };

  const submitResponse = async () => {
    if (!selectedScenario || responseText.trim().length < 20) {
      showToast('error', 'Please write at least a couple of sentences to keep the dataset useful.');
      return;
    }

    setActionLoading(true);
    setPhase('extracting');

    try {
      // Insert the response
      const { data: responseRow, error: insertErr } = await supabase
        .from('eval_responses')
        .insert({
          scenario_id: selectedScenario.id,
          response_text: responseText,
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      // Call the extraction edge function
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/eval-train`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'extract',
          response_id: responseRow.id,
          response_text: responseText,
          scenario_prompt: selectedScenario.prompt,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Extraction failed: ${errBody}`);
      }

      const result: ExtractionResponse = await res.json();
      setExtraction(result);
      setCorrectedText(result.extracted_text);
      setPhase('review');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Something went wrong');
      setPhase('roleplay');
    } finally {
      setActionLoading(false);
    }
  };

  const submitVerification = async (status: 'confirmed' | 'corrected' | 'rejected') => {
    if (!extraction) return;

    setActionLoading(true);
    try {
      const { error: err } = await supabase.from('eval_verifications').insert({
        extraction_id: extraction.extraction_id,
        status,
        corrected_json: status === 'corrected' ? { corrected_text: correctedText } : null,
        notes: '',
      });

      if (err) throw err;

      setVerificationStatus(status);
      setCompletedCount((c) => c + 1);
      setPhase('done');
      showToast('success', status === 'confirmed' ? 'Extraction confirmed — thank you!' : status === 'corrected' ? 'Corrections saved — this helps a lot!' : 'Marked as inaccurate — thanks for the feedback!');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save verification');
    } finally {
      setActionLoading(false);
    }
  };

  const resetToPicker = () => {
    setPhase('picker');
    setSelectedScenario(null);
    setResponseText('');
    setExtraction(null);
    setVerificationStatus(null);
    setCorrectedText('');
  };

  return (
    <div className="ds-page">
      <PageHeader
        title="Memory Training"
        subtitle="Help improve memory accuracy by role-playing through realistic scenarios"
        icon={Brain}
        accent="#c084fc"
        width="lg"
        back={() => navigate(-1)}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {toast && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-red-500/15 text-red-300'
            }`}
          >
            {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.text}
          </div>
        )}

        {/* Progress badge */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: 'rgba(192,132,252,0.10)', border: '1px solid rgba(192,132,252,0.25)' }}
          >
            <Trophy className="w-4 h-4 text-purple-300" />
            <span className="text-purple-200 text-sm font-medium">
              {completedCount} {completedCount === 1 ? 'contribution' : 'contributions'}
            </span>
          </div>
          {completedCount >= 5 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-amber-200 text-sm font-medium">Trusted Contributor</span>
            </div>
          )}
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Phase: Picker */}
        {!loading && !error && phase === 'picker' && (
          <ScenarioPicker scenarios={scenarios} onSelect={startScenario} />
        )}

        {/* Phase: Roleplay */}
        {phase === 'roleplay' && selectedScenario && (
          <RoleplayPanel
            scenario={selectedScenario}
            responseText={responseText}
            onResponseChange={setResponseText}
            onSubmit={submitResponse}
            onBack={resetToPicker}
            actionLoading={actionLoading}
          />
        )}

        {/* Phase: Extracting */}
        {phase === 'extracting' && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
              <Brain className="w-7 h-7 text-purple-400 absolute inset-0 m-auto" />
            </div>
            <p className="text-purple-200/70 text-sm mt-6 font-medium">Analyzing your response...</p>
            <p className="text-white/30 text-xs mt-1">Extracting memories the same way the companion would</p>
          </div>
        )}

        {/* Phase: Review */}
        {phase === 'review' && extraction && selectedScenario && (
          <ReviewPanel
            extraction={extraction}
            scenario={selectedScenario}
            correctedText={correctedText}
            onCorrectedTextChange={setCorrectedText}
            onConfirm={() => submitVerification('confirmed')}
            onCorrect={() => submitVerification('corrected')}
            onReject={() => submitVerification('rejected')}
            actionLoading={actionLoading}
          />
        )}

        {/* Phase: Done */}
        {phase === 'done' && selectedScenario && (
          <DonePanel
            status={verificationStatus}
            completedCount={completedCount}
            onAnother={resetToPicker}
          />
        )}
      </div>
    </div>
  );
}

function ScenarioPicker({
  scenarios,
  onSelect,
}: {
  scenarios: Scenario[];
  onSelect: (s: Scenario) => void;
}) {
  return (
    <div>
      <div
        className="rounded-2xl p-5 mb-6"
        style={{ background: 'rgba(192,132,252,0.06)', border: '1px solid rgba(192,132,252,0.20)' }}
      >
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-purple-300 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-purple-100/90 text-sm leading-relaxed font-medium mb-1">How this works</p>
            <p className="text-purple-200/50 text-xs leading-relaxed">
              Pick a scenario, role-play your response as if you're texting a close friend, then review
              what the AI extracted. Your confirmations and corrections build a dataset that makes memory
              more accurate for everyone. Stay in character — goofy answers don't help the dataset.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {scenarios.map((scenario) => {
          const catColor = CATEGORY_COLORS[scenario.category] ?? 'slate';
          const diffColor = DIFFICULTY_COLORS[scenario.difficulty] ?? 'slate';
          return (
            <button
              key={scenario.id}
              onClick={() => onSelect(scenario)}
              className="text-left rounded-xl p-5 border border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06] transition-all duration-200 group"
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium bg-${catColor}-500/15 text-${catColor}-300`}
                >
                  {scenario.category}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium bg-${diffColor}-500/15 text-${diffColor}-300`}
                >
                  {DIFFICULTY_LABELS[scenario.difficulty] ?? scenario.difficulty}
                </span>
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 group-hover:translate-x-1 transition-all ml-auto" />
              </div>
              <h3 className="text-white font-semibold text-base mb-1.5">{scenario.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed line-clamp-2">{scenario.prompt}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoleplayPanel({
  scenario,
  responseText,
  onResponseChange,
  onSubmit,
  onBack,
  actionLoading,
}: {
  scenario: Scenario;
  responseText: string;
  onResponseChange: (text: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  actionLoading: boolean;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm mb-6"
      >
        <X className="w-4 h-4" />
        Back to scenarios
      </button>

      {/* Scenario context */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-5 h-5 text-purple-300" />
          <span className="text-purple-200/60 text-xs font-medium uppercase tracking-wider">Scenario</span>
        </div>
        {scenario.context_lines.map((line, i) => (
          <p key={i} className="text-white/30 text-xs italic mb-2">{line}</p>
        ))}
        <p className="text-white/90 text-base leading-relaxed">{scenario.prompt}</p>
      </div>

      {/* Response input */}
      <div className="mb-4">
        <label className="text-white/60 text-sm font-medium mb-2 block">
          Your response (role-play as yourself)
        </label>
        <textarea
          value={responseText}
          onChange={(e) => onResponseChange(e.target.value)}
          placeholder="Type your response as if you're texting a close friend. Be natural, specific, and honest. Include real details — names, numbers, feelings, places..."
          rows={8}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
          disabled={actionLoading}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-white/30 text-xs">
            {responseText.length} characters {responseText.length < 20 && '(need at least 20)'}
          </span>
          <span className="text-white/30 text-xs">Be specific and stay in character</span>
        </div>
      </div>

      <button
        onClick={onSubmit}
        disabled={actionLoading || responseText.trim().length < 20}
        className="w-full py-3.5 rounded-xl text-base font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed
        bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:shadow-lg hover:shadow-purple-500/20"
      >
        {actionLoading ? (
          <span className="flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Analyzing...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" />
            Submit & See What Was Extracted
          </span>
        )}
      </button>
    </div>
  );
}

function ReviewPanel({
  extraction,
  scenario,
  correctedText,
  onCorrectedTextChange,
  onConfirm,
  onCorrect,
  onReject,
  actionLoading,
}: {
  extraction: ExtractionResponse;
  scenario: Scenario;
  correctedText: string;
  onCorrectedTextChange: (text: string) => void;
  onConfirm: () => void;
  onCorrect: () => void;
  onReject: () => void;
  actionLoading: boolean;
}) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const extractedJson = useMemo(() => {
    try {
      const json = extraction.extracted_json;
      const facts = (json.user_facts as Record<string, string[]>) ?? {};
      const allFacts = [
        ...(facts.personal ?? []),
        ...(facts.preferences ?? []),
        ...(facts.schedule ?? []),
        ...(facts.relationships ?? []),
      ];
      const emotional = (json.emotional_landscape as Record<string, unknown>) ?? {};
      const mood = emotional.current_mood_arc as string ?? '';
      const moments = (json.key_moments as Array<{ summary: string; emotional_weight: string }>) ?? [];
      const threads = (json.ongoing_threads as Array<{ topic: string; last_status: string }>) ?? [];

      return { allFacts, mood, moments, threads };
    } catch {
      return { allFacts: [], mood: '', moments: [], threads: [] };
    }
  }, [extraction]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Eye className="w-5 h-5 text-purple-300" />
        <h2 className="text-white font-semibold text-lg">Review What Was Extracted</h2>
      </div>

      {/* Expected facts (hidden — for admin comparison, not shown to user) */}
      {/* The user reviews the extraction itself, not the expected answer */}

      {/* Extraction display */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-white/60 text-xs font-medium uppercase tracking-wider">
            {mode === 'view' ? 'What the AI caught' : 'Your corrections'}
          </span>
          <button
            onClick={() => setMode(mode === 'view' ? 'edit' : 'view')}
            className="flex items-center gap-1.5 text-purple-300 hover:text-purple-200 text-xs font-medium transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {mode === 'view' ? 'Edit' : 'Preview'}
          </button>
        </div>

        {mode === 'view' ? (
          <div className="space-y-4">
            {extractedJson.allFacts.length > 0 && (
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Facts</p>
                <ul className="space-y-1.5">
                  {extractedJson.allFacts.map((fact, i) => (
                    <li key={i} className="text-white/80 text-sm flex gap-2">
                      <span className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-purple-400/60" />
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {extractedJson.mood && (
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Emotional Arc</p>
                <p className="text-white/80 text-sm">{extractedJson.mood}</p>
              </div>
            )}
            {extractedJson.moments.length > 0 && (
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Key Moments</p>
                <ul className="space-y-1.5">
                  {extractedJson.moments.map((m, i) => (
                    <li key={i} className="text-white/80 text-sm flex gap-2">
                      <span
                        className={`flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${
                          m.emotional_weight === 'high' ? 'bg-rose-400/60' : 'bg-amber-400/60'
                        }`}
                      />
                      {m.summary}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {extractedJson.threads.length > 0 && (
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Ongoing Threads</p>
                <ul className="space-y-1.5">
                  {extractedJson.threads.map((t, i) => (
                    <li key={i} className="text-white/80 text-sm flex gap-2">
                      <span className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-cyan-400/60" />
                      <span><strong className="text-white/90">{t.topic}</strong> — {t.last_status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {extractedJson.allFacts.length === 0 && !extractedJson.mood && extractedJson.moments.length === 0 && (
              <p className="text-white/40 text-sm italic">Nothing significant was extracted from this response.</p>
            )}
          </div>
        ) : (
          <textarea
            value={correctedText}
            onChange={(e) => onCorrectedTextChange(e.target.value)}
            rows={10}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
            placeholder="Edit the extraction to match what the AI should have caught..."
          />
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={onConfirm}
          disabled={actionLoading}
          className="py-3 rounded-xl text-sm font-semibold transition-all bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 disabled:opacity-40"
        >
          <span className="flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            Looks Right
          </span>
        </button>
        <button
          onClick={onCorrect}
          disabled={actionLoading}
          className="py-3 rounded-xl text-sm font-semibold transition-all bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 disabled:opacity-40"
        >
          <span className="flex items-center justify-center gap-2">
            <Edit3 className="w-4 h-4" />
            {mode === 'edit' ? 'Submit Corrections' : 'Needs Corrections'}
          </span>
        </button>
        <button
          onClick={onReject}
          disabled={actionLoading}
          className="py-3 rounded-xl text-sm font-semibold transition-all bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30 disabled:opacity-40"
        >
          <span className="flex items-center justify-center gap-2">
            <X className="w-4 h-4" />
            Way Off
          </span>
        </button>
      </div>
    </div>
  );
}

function DonePanel({
  status,
  completedCount,
  onAnother,
}: {
  status: 'confirmed' | 'corrected' | 'rejected' | null;
  completedCount: number;
  onAnother: () => void;
}) {
  const messages: Record<string, { title: string; subtitle: string; color: string }> = {
    confirmed: {
      title: 'Confirmed!',
      subtitle: 'Your validation helps the system learn what accurate extraction looks like.',
      color: 'emerald',
    },
    corrected: {
      title: 'Corrections Saved',
      subtitle: 'This is the most valuable type of feedback — it shows exactly where extraction goes wrong.',
      color: 'amber',
    },
    rejected: {
      title: 'Marked as Inaccurate',
      subtitle: 'Thanks for the honest feedback. This helps identify systematic extraction failures.',
      color: 'red',
    },
  };

  const msg = messages[status ?? 'confirmed'];

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div
        className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6`}
        style={{
          background: `rgba(${msg.color === 'emerald' ? '16,185,129' : msg.color === 'amber' ? '245,158,11' : '239,68,68'},0.12)`,
          border: `1px solid rgba(${msg.color === 'emerald' ? '16,185,129' : msg.color === 'amber' ? '245,158,11' : '239,68,68'},0.25)`,
        }}
      >
        <Target className="w-9 h-9" style={{ color: `rgb(${msg.color === 'emerald' ? '52,211,153' : msg.color === 'amber' ? '252,211,77' : '248,113,113'})` }} />
      </div>
      <h2 className="text-white font-bold text-2xl mb-2">{msg.title}</h2>
      <p className="text-white/50 text-sm text-center max-w-md leading-relaxed mb-8">{msg.subtitle}</p>

      <div
        className="flex items-center gap-3 px-5 py-3 rounded-xl mb-8"
        style={{ background: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.20)' }}
      >
        <Trophy className="w-5 h-5 text-purple-300" />
        <span className="text-purple-200 text-sm font-medium">
          {completedCount} {completedCount === 1 ? 'contribution' : 'contributions'} total
        </span>
        {completedCount >= 5 && (
          <span className="text-amber-300 text-xs flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Trusted
          </span>
        )}
      </div>

      <button
        onClick={onAnother}
        className="px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:shadow-lg hover:shadow-purple-500/20 transition-all"
      >
        <span className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Try Another Scenario
        </span>
      </button>
    </div>
  );
}
