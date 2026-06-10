import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, FileText, Clock, Trash2, ArrowLeft, BookOpen, X, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { FeatureLoadingSplash } from '../components/FeatureLoadingSplash';
import { CoAuthorCanvas } from '../components/CoAuthorCanvas';
import { coAuthorService, CoAuthorSession } from '../services/coAuthorService';
import { getUserDefaultCompanion } from '../services/companionService';
import { supabase } from '../shared/supabase/client';

export function CoAuthorPage({ onBack }: { onBack?: () => void } = {}) {
  const navigate = useNavigate();
  const goBack = () => { if (onBack) { onBack(); } else { navigate('/lobby'); } };
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

  const [sessions, setSessions] = useState<CoAuthorSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [selectedPurpose, setSelectedPurpose] = useState<'Writing' | 'Research'>('Writing');
  const [sessionAbout, setSessionAbout] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const data = await coAuthorService.getUserSessions();
      setSessions(data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSession = async () => {
    try {
      setIsCreating(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      const companion = await getUserDefaultCompanion(user.id);

      if (!companion) {
        navigate('/create-companion-avatar');
        return;
      }

      const newSession = await coAuthorService.createSession(
        companion.id,
        newSessionTitle || 'Untitled Session',
        selectedPurpose,
        sessionAbout
      );

      setShowNewSessionModal(false);
      setNewSessionTitle('');
      setSessionAbout('');
      navigate(`/co-author?session=${newSession.id}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Failed to create session: ${msg}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteId(sessionId);
  };

  const confirmDeleteSession = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await coAuthorService.deleteSession(id);
      setSessions(sessions.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (sessionId) {
    return <CoAuthorCanvas sessionId={sessionId} />;
  }

  if (isLoading) {
    return (
      <FeatureLoadingSplash
        icon={FileText}
        label="Loading Co-Author..."
        accentColor="#60a5fa"
        bgColor="#040c1a"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="sticky top-0 z-30 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="p-2 hover:bg-white/8 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </button>
            <BookOpen className="w-5 h-5 text-violet-400" />
            <span className="font-bold text-white text-lg">Co-Author</span>
          </div>
          <button
            onClick={() => setShowNewSessionModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-violet-900/30"
          >
            <Plus className="w-4 h-4" />
            New Session
          </button>
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {sessions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-5">
              <FileText className="w-8 h-8 text-white/30" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No sessions yet
            </h3>
            <p className="text-white/40 mb-6">
              Create your first co-authoring session to get started
            </p>
            <button
              onClick={() => setShowNewSessionModal(true)}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors inline-flex items-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Session
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => navigate(`/co-author?session=${session.id}`)}
                className="bg-white/5 hover:bg-white/8 rounded-xl border border-white/10 hover:border-white/20 p-6 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-violet-500/15 border border-violet-500/20">
                      <FileText className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-violet-500/15 text-violet-300 border border-violet-500/20">
                        {session.purpose}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/15 rounded-lg transition-all text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="font-semibold text-white text-base mb-2 line-clamp-2">
                  {session.title}
                </h3>

                <div className="flex items-center gap-2 text-sm text-white/40">
                  <Clock className="w-4 h-4" />
                  <span>{formatDate(session.last_accessed_at)}</span>
                </div>

                {session.session_prompt && (
                  <p className="mt-3 text-sm text-white/40 line-clamp-2">
                    {session.session_prompt}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Session Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f1117] border border-white/10 rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">
              New Co-Author Session
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Session Title
                </label>
                <input
                  type="text"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="e.g., Novel Chapter 3, Research Notes"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-3">
                  Purpose
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'Writing' as const, label: 'Writing', desc: 'Creative, expressive, generative' },
                    { value: 'Research' as const, label: 'Research', desc: 'Structured, investigative, analytical' },
                  ].map((purpose) => (
                    <button
                      key={purpose.value}
                      onClick={() => setSelectedPurpose(purpose.value)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        selectedPurpose === purpose.value
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-white/10 hover:border-white/20 bg-white/3'
                      }`}
                    >
                      <div className="font-semibold text-white">{purpose.label}</div>
                      <div className="text-sm text-white/50 mt-1">{purpose.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  What's this session about?
                </label>
                <textarea
                  value={sessionAbout}
                  onChange={(e) => setSessionAbout(e.target.value)}
                  placeholder="Describe what you're working on, any specific goals, or context that will help guide the collaboration..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none"
                  rows={4}
                />
                <p className="text-xs text-white/30 mt-2">
                  This helps your companion understand the direction and provide better assistance
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowNewSessionModal(false);
                  setNewSessionTitle('');
                  setSessionAbout('');
                }}
                disabled={isCreating}
                className="flex-1 px-6 py-3 border border-white/15 text-white/70 rounded-lg hover:bg-white/5 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleCreateSession();
                }}
                disabled={isCreating}
                className="flex-1 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {pendingDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full text-center"
            >
              <p className="text-white font-semibold mb-2">Delete session?</p>
              <p className="text-gray-400 text-sm mb-6">This cannot be undone.</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteSession}
                  className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500/40 text-red-200 px-5 py-3 rounded-xl flex items-center gap-3 shadow-xl max-w-sm w-full"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm flex-1">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)}>
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
