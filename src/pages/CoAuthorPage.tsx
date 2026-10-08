import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, FileText, Clock, Trash2, BookOpen, X, AlertCircle, type LucideIcon } from 'lucide-react';
import { PageHeader, Pill } from '../shared/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { LoadingState } from '../shared/ui';
import { CoAuthorCanvas } from '../components/CoAuthorCanvas';
import { coAuthorService, CoAuthorSession } from '../services/coAuthorService';
import { getUserDefaultCompanion } from '../services/companionService';
import { supabase } from '../shared/supabase/client';
import { CO_AUTHOR_TEMPLATES, getTemplateById, type CoAuthorTemplate } from '../config/coAuthorTemplates';

export function CoAuthorPage({ onBack }: { onBack?: () => void } = {}) {
  const navigate = useNavigate();
  const goBack = () => { if (onBack) { onBack(); } else { navigate('/lobby'); } };
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

  const [sessions, setSessions] = useState<CoAuthorSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CoAuthorTemplate | null>(null);
  const [customTitle, setCustomTitle] = useState('');
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

      const template = selectedTemplate;
      const title = customTitle || template?.label || 'Untitled Session';
      const purpose = template?.purpose || 'Writing';
      const prompt = sessionAbout || template?.starterPrompt || '';

      const newSession = await coAuthorService.createSession(
        companion.id,
        title,
        purpose,
        prompt,
        '1-2 sentences',
        template?.id ?? null,
      );

      setShowNewSessionModal(false);
      setCustomTitle('');
      setSessionAbout('');
      setSelectedTemplate(null);
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

  const getTemplateIcon = (sessionId: string): LucideIcon => {
    const s = sessions.find(x => x.id === sessionId);
    const tpl = getTemplateById(s?.template_id);
    return tpl?.icon || FileText;
  };

  if (sessionId) {
    return <CoAuthorCanvas sessionId={sessionId} />;
  }

  if (isLoading) {
    return (
      <LoadingState label="Loading Co-Author..." />
    );
  }

  return (
    <div className="ds-page text-white">
      <PageHeader
        title="Co-Author"
        icon={BookOpen}
        accent="#a78bfa"
        back={goBack}
        actions={
          <Pill tone="#a78bfa" icon={<Plus className="w-4 h-4" />} onClick={() => setShowNewSessionModal(true)} hideLabelOnMobile>
            New Session
          </Pill>
        }
      />

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
              Pick a template to get started — your AI companion will guide you through it
            </p>
            <button
              onClick={() => setShowNewSessionModal(true)}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors inline-flex items-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              Choose a Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => {
              const TemplateIcon = getTemplateIcon(session.id);
              const tpl = getTemplateById(session.template_id);
              return (
                <div
                  key={session.id}
                  onClick={() => navigate(`/co-author?session=${session.id}`)}
                  className="bg-white/5 hover:bg-white/8 rounded-xl border border-white/10 hover:border-white/20 p-6 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-violet-500/15 border border-violet-500/20">
                        <TemplateIcon className="w-5 h-5 text-violet-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium px-2 py-1 rounded bg-violet-500/15 text-violet-300 border border-violet-500/20">
                          {tpl?.label || session.purpose}
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
              );
            })}
          </div>
        )}
      </div>

      {/* New Session Modal — Template Gallery */}
      {showNewSessionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f1117] border border-white/10 rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Choose a Template</h2>
              <button
                onClick={() => {
                  setShowNewSessionModal(false);
                  setSelectedTemplate(null);
                  setCustomTitle('');
                  setSessionAbout('');
                }}
                className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!selectedTemplate ? (
              <>
                <p className="text-white/50 text-sm mb-6">
                  Each template gives your companion a specific role and structure to guide you through the document.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {CO_AUTHOR_TEMPLATES.map((tpl) => {
                    const Icon = tpl.icon;
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => {
                          setSelectedTemplate(tpl);
                          setCustomTitle(tpl.label);
                        }}
                        className="p-4 rounded-xl border border-white/10 hover:border-violet-500/50 bg-white/5 hover:bg-violet-500/10 transition-all text-left group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                          <Icon className="w-5 h-5 text-violet-400" />
                        </div>
                        <div className="font-semibold text-white text-sm mb-1">{tpl.label}</div>
                        <div className="text-xs text-white/40 line-clamp-2">{tpl.description}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-white/10 pt-4">
                  <button
                    onClick={() => {
                      setSelectedTemplate(null);
                      setCustomTitle('');
                    }}
                    className="text-sm text-white/50 hover:text-white/70 transition-colors"
                  >
                    Skip — start with a blank document
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                {/* Selected template summary */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    {(() => { const Icon = selectedTemplate.icon; return <Icon className="w-6 h-6 text-violet-300" />; })()}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{selectedTemplate.label}</div>
                    <div className="text-sm text-white/50 mt-1">{selectedTemplate.description}</div>
                    <div className="mt-3 space-y-1">
                      <div className="text-xs text-white/40 font-medium uppercase tracking-wide">Your companion will ask:</div>
                      {selectedTemplate.guidingQuestions.map((q, i) => (
                        <div key={i} className="text-sm text-white/60 flex items-start gap-2">
                          <span className="text-violet-400 mt-0.5">•</span>
                          {q}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="text-white/40 hover:text-white/60 text-sm"
                  >
                    Change
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Session Title
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g., Resume for Senior PM role"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    What's this about? <span className="text-white/30">(optional)</span>
                  </label>
                  <textarea
                    value={sessionAbout}
                    onChange={(e) => setSessionAbout(e.target.value)}
                    placeholder={selectedTemplate.starterPrompt}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none"
                    rows={3}
                  />
                  <p className="text-xs text-white/30 mt-2">
                    Any details you add here help your companion tailor its approach.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowNewSessionModal(false);
                  setCustomTitle('');
                  setSessionAbout('');
                  setSelectedTemplate(null);
                }}
                disabled={isCreating}
                className="flex-1 px-6 py-3 border border-white/15 text-white/70 rounded-lg hover:bg-white/5 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              {selectedTemplate && (
                <button
                  onClick={handleCreateSession}
                  disabled={isCreating}
                  className="flex-1 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Start Writing'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AnimatePresence>
        {pendingDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setPendingDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#0f1117] border border-white/10 rounded-2xl max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Delete this session?</h3>
                  <p className="text-sm text-white/50">This cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className="flex-1 px-4 py-2.5 border border-white/15 text-white/70 rounded-lg hover:bg-white/5 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteSession}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {errorMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500/40 text-red-200 px-5 py-3 rounded-xl flex items-center gap-3 shadow-xl max-w-sm w-full">
          <span className="text-sm flex-1">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
