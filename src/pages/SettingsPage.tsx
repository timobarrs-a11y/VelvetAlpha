import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Shield, Palette, Lock, Download, Trash2, ChevronRight, Check, AlertTriangle, Eye, EyeOff, LogOut, Mail, Smartphone, Moon, Sun, Monitor, Globe, Key, User, Compass, Play, Brain, Plus, CreditCard as Edit3, CreditCard, ExternalLink } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { gdprService } from '../services/gdprService';
import { onboardingService } from '../services/onboardingService';
import { getCompanions } from '../services/companionService';
import { getUserExperts, deleteUserExpert, UserExpert } from '../services/expertService';
import { getExpertById, getCuratedExperts, ExpertConfig } from '../config/signatureExperts';

type Tab = 'notifications' | 'privacy' | 'appearance' | 'experts' | 'tour' | 'security' | 'data';

interface NotificationSettings {
  push_enabled: boolean;
  email_digest: boolean;
  companion_messages: boolean;
  calendar_reminders: boolean;
  daily_checkin: boolean;
  system_updates: boolean;
}

interface PrivacySettings {
  activity_tracking: boolean;
  analytics_sharing: boolean;
  personalization: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  push_enabled: true,
  email_digest: false,
  companion_messages: true,
  calendar_reminders: true,
  daily_checkin: true,
  system_updates: true,
};

const DEFAULT_PRIVACY: PrivacySettings = {
  activity_tracking: true,
  analytics_sharing: true,
  personalization: true,
};

export function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('notifications');
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [privacy, setPrivacy] = useState<PrivacySettings>(DEFAULT_PRIVACY);
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'system'>('dark');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [exportLoading, setExportLoading] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [userEmail, setUserEmail] = useState('');

  const [tourProgress, setTourProgress] = useState<{ onboarding_complete: boolean; last_tour_at: string | null; steps_completed: string[] } | null>(null);
  const [tourStarting, setTourStarting] = useState(false);

  const [userExperts, setUserExperts] = useState<UserExpert[]>([]);
  const [companionsWithExperts, setCompanionsWithExperts] = useState<{ id: string; name: string; expertName: string | null; expertDomain: string | null }[]>([]);
  const [expertsLoading, setExpertsLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? '');
        onboardingService.getProgress(user.id).then(p => {
          if (p) setTourProgress({
            onboarding_complete: p.onboarding_complete,
            last_tour_at: p.last_tour_at,
            steps_completed: p.steps_completed || [],
          });
        }).catch(() => {});
      }
    });
    loadSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'experts') loadExperts();
  }, [activeTab]);

  const loadExperts = async () => {
    setExpertsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [experts, companions] = await Promise.all([
        getUserExperts(user.id),
        getCompanions(user.id),
      ]);
      setUserExperts(experts);

      const mapped = companions.map(c => {
        let expertName: string | null = null;
        let expertDomain: string | null = null;
        if (c.signature_expert) {
          if (c.signature_expert_source === 'curated') {
            const curated = getExpertById(c.signature_expert);
            expertName = curated?.name ?? null;
            expertDomain = curated?.domain ?? null;
          } else {
            const ue = experts.find(e => e.id === c.signature_expert);
            expertName = ue?.name ?? null;
            expertDomain = ue?.domain ?? null;
          }
        }
        return { id: c.id, name: c.custom_name, expertName, expertDomain };
      });
      setCompanionsWithExperts(mapped);
    } finally {
      setExpertsLoading(false);
    }
  };

  const handleDeleteExpert = async (expertId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await deleteUserExpert(user.id, expertId);
    setUserExperts(prev => prev.filter(e => e.id !== expertId));
  };

  const handleRestartTour = async () => {
    setTourStarting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await onboardingService.restartTour(user.id, 'manual_replay');
      const companions = await getCompanions(user.id);
      const primary = companions[0];
      if (primary) {
        navigate(`/chat?companion=${primary.id}&tour=1`);
      } else {
        navigate('/lobby');
      }
    } finally {
      setTourStarting(false);
    }
  };

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        if (data.notification_settings) setNotifications({ ...DEFAULT_NOTIFICATIONS, ...data.notification_settings });
        if (data.privacy_settings) setPrivacy({ ...DEFAULT_PRIVACY, ...data.privacy_settings });
        if (data.theme_mode) setThemeMode(data.theme_mode);
      }
    } catch {
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('user_settings').upsert({
        user_id: user.id,
        notification_settings: notifications,
        privacy_settings: privacy,
        theme_mode: themeMode,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setPwMessage({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    setPwLoading(true);
    setPwMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwMessage({ type: 'success', text: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setPwMessage({ type: 'error', text: e.message || 'Failed to update password.' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const data = await gdprService.exportUserData();
      gdprService.downloadAsJSON(data);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 4000);
    } catch {
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (deleteInput.toLowerCase() !== 'delete my account') return;
    setDeleteLoading(true);
    setDeleteMessage(null);
    const result = await gdprService.requestAccountDeletion();
    setDeleteMessage({ type: result.success ? 'success' : 'error', text: result.message });
    setDeleteLoading(false);
    if (result.success) {
      setDeleteConfirm(false);
      setDeleteInput('');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const TABS: { id: Tab; label: string; icon: typeof Bell }[] = [
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'experts', label: 'AI Experts', icon: Brain },
    { id: 'tour', label: 'Tour & Help', icon: Compass },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'data', label: 'My Data', icon: Download },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0d1128 0%, #090c1e 50%, #060810 100%)' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-white/40 text-sm">{userEmail}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <aside className="md:w-52 flex-shrink-0">
            <nav className="space-y-1">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition text-left ${
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {tab.label}
                    {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                );
              })}

              <div className="pt-4 border-t border-white/10 mt-4">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition text-left"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  Sign Out
                </button>
              </div>
            </nav>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>

              {activeTab === 'notifications' && (
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-white mb-1">Notifications</h2>
                  <p className="text-white/40 text-sm mb-6">Control what you get notified about.</p>

                  <div className="space-y-1">
                    <ToggleRow
                      icon={Smartphone}
                      label="Push Notifications"
                      description="Allow push notifications in your browser"
                      value={notifications.push_enabled}
                      onChange={v => setNotifications(p => ({ ...p, push_enabled: v }))}
                    />
                    <ToggleRow
                      icon={Mail}
                      label="Weekly Email Digest"
                      description="Receive a weekly summary of your activity"
                      value={notifications.email_digest}
                      onChange={v => setNotifications(p => ({ ...p, email_digest: v }))}
                    />
                    <ToggleRow
                      icon={Bell}
                      label="Companion Messages"
                      description="Proactive messages from your companions"
                      value={notifications.companion_messages}
                      onChange={v => setNotifications(p => ({ ...p, companion_messages: v }))}
                    />
                    <ToggleRow
                      icon={Bell}
                      label="Calendar Reminders"
                      description="Reminders for upcoming events"
                      value={notifications.calendar_reminders}
                      onChange={v => setNotifications(p => ({ ...p, calendar_reminders: v }))}
                    />
                    <ToggleRow
                      icon={Bell}
                      label="Daily Check-in Reminder"
                      description="Reminder to maintain your streak"
                      value={notifications.daily_checkin}
                      onChange={v => setNotifications(p => ({ ...p, daily_checkin: v }))}
                    />
                    <ToggleRow
                      icon={Bell}
                      label="System Updates"
                      description="Important announcements and new features"
                      value={notifications.system_updates}
                      onChange={v => setNotifications(p => ({ ...p, system_updates: v }))}
                    />
                  </div>

                  <SaveButton saving={saving} saved={saved} onSave={saveSettings} />
                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-white mb-1">Privacy</h2>
                  <p className="text-white/40 text-sm mb-6">Manage how your data is used.</p>

                  <div className="space-y-1 mb-6">
                    <ToggleRow
                      icon={Globe}
                      label="Activity Tracking"
                      description="Track which features you use to improve your experience"
                      value={privacy.activity_tracking}
                      onChange={v => setPrivacy(p => ({ ...p, activity_tracking: v }))}
                    />
                    <ToggleRow
                      icon={Globe}
                      label="Anonymous Analytics"
                      description="Share anonymous usage data to help improve Velvet"
                      value={privacy.analytics_sharing}
                      onChange={v => setPrivacy(p => ({ ...p, analytics_sharing: v }))}
                    />
                    <ToggleRow
                      icon={User}
                      label="Personalization"
                      description="Use your data to personalize companion responses"
                      value={privacy.personalization}
                      onChange={v => setPrivacy(p => ({ ...p, personalization: v }))}
                    />
                  </div>

                  <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-white/50 text-sm leading-relaxed">
                      Velvet is committed to your privacy. We never sell your personal data to third parties.
                      Your conversations are encrypted and used only to power your companion's memory.
                      You can export or delete all your data at any time from the <strong className="text-white/70">My Data</strong> tab.
                    </p>
                  </div>

                  <SaveButton saving={saving} saved={saved} onSave={saveSettings} />
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-white mb-1">Appearance</h2>
                  <p className="text-white/40 text-sm mb-6">Customize how Velvet looks.</p>

                  <div className="mb-6">
                    <p className="text-sm font-medium text-white/70 mb-3">Theme Mode</p>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { value: 'dark', label: 'Dark', icon: Moon },
                        { value: 'light', label: 'Light', icon: Sun },
                        { value: 'system', label: 'System', icon: Monitor },
                      ] as const).map(opt => {
                        const Icon = opt.icon;
                        const selected = themeMode === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setThemeMode(opt.value)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition ${
                              selected
                                ? 'border-rose-500/50 bg-rose-500/10 text-white'
                                : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/8 hover:text-white/70'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="text-sm font-medium">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-white/30 text-xs mt-3">Full theme support coming soon. Velvet currently uses dark mode.</p>
                  </div>

                  <div className="rounded-xl p-4 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-sm font-medium text-white/70 mb-2">Cursor & Effects</p>
                    <p className="text-white/40 text-sm mb-3">Customize your cursor animations, trails, and button effects from the customization panel.</p>
                    <button
                      onClick={() => navigate('/profile')}
                      className="text-sm text-rose-400 hover:text-rose-300 transition font-medium flex items-center gap-1"
                    >
                      Open Customization Panel <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <SaveButton saving={saving} saved={saved} onSave={saveSettings} />
                </div>
              )}

              {activeTab === 'tour' && (
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-white mb-1">Tour & Help</h2>
                  <p className="text-white/40 text-sm mb-6">Have Atlas walk you through your space again — useful if anything feels unfamiliar.</p>

                  <div className="rounded-xl p-5 border border-white/10 mb-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="flex gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mt-0.5" style={{ background: 'rgba(251,191,36,0.15)' }}>
                        <Compass className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium mb-1">Replay the tour</p>
                        <p className="text-white/40 text-sm leading-relaxed">Atlas will dock beside your companion chat and re-walk you through the left rail shortcuts, the thread toolbar, and the nav radial. You can stop any time.</p>
                      </div>
                    </div>

                    {tourProgress && (
                      <div className="mb-4 flex items-center gap-3 text-xs text-white/50">
                        <span className={`px-2 py-1 rounded-md font-semibold ${tourProgress.onboarding_complete ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
                          {tourProgress.onboarding_complete ? 'Completed' : 'In progress'}
                        </span>
                        {tourProgress.last_tour_at && (
                          <span>Last tour: {new Date(tourProgress.last_tour_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        )}
                        {tourProgress.steps_completed?.length > 0 && (
                          <span>{tourProgress.steps_completed.length} steps completed</span>
                        )}
                      </div>
                    )}

                    <button
                      onClick={handleRestartTour}
                      disabled={tourStarting}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}
                    >
                      <Play className="w-4 h-4" />
                      {tourStarting ? 'Starting...' : 'Restart the tour'}
                    </button>
                  </div>

                  <div className="rounded-xl p-4 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-white/50 text-sm leading-relaxed">
                      Atlas is always one tap away from inside the chat — the nav radial has a direct link, and you can ask any question while the tour is running.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-white mb-1">Security</h2>
                  <p className="text-white/40 text-sm mb-6">Manage your account security.</p>

                  <div className="mb-8">
                    <p className="text-sm font-medium text-white/70 mb-1">Signed in as</p>
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(244,63,107,0.2)' }}>
                        <Mail className="w-4 h-4 text-rose-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{userEmail}</p>
                        <p className="text-white/40 text-xs">Email / Password account</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <p className="text-sm font-medium text-white/70 mb-4 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Change Password
                    </p>
                    <div className="space-y-3">
                      <PasswordInput
                        label="New Password"
                        value={newPassword}
                        onChange={setNewPassword}
                        show={showNewPw}
                        onToggle={() => setShowNewPw(p => !p)}
                        placeholder="Minimum 8 characters"
                      />
                      <PasswordInput
                        label="Confirm New Password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        show={showNewPw}
                        onToggle={() => setShowNewPw(p => !p)}
                        placeholder="Repeat new password"
                      />
                    </div>

                    {pwMessage && (
                      <div className={`mt-3 p-3 rounded-lg text-sm ${
                        pwMessage.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {pwMessage.text}
                      </div>
                    )}

                    <button
                      onClick={handlePasswordChange}
                      disabled={pwLoading || !newPassword || !confirmPassword}
                      className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #f43f6b, #e11d48)' }}
                    >
                      {pwLoading ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>

                  <div className="border-t border-white/10 pt-6 mb-6">
                    <p className="text-sm font-medium text-white/70 mb-1 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Subscription & Billing
                    </p>
                    <p className="text-white/40 text-sm mb-4">Manage your plan, view invoices, upgrade, or cancel your subscription.</p>
                    <button
                      onClick={() => navigate('/billing')}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white border border-white/15 hover:bg-white/8 transition"
                    >
                      <CreditCard className="w-4 h-4" />
                      Manage Subscription
                      <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                    </button>
                  </div>

                  <div className="border-t border-white/10 pt-6">
                    <p className="text-sm font-medium text-white/70 mb-1">Active Sessions</p>
                    <p className="text-white/40 text-sm mb-4">Signing out will end your current session on this device.</p>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'experts' && (
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-white mb-1">AI Experts</h2>
                  <p className="text-white/40 text-sm mb-6">Manage your custom experts and see which companions have experts attached.</p>

                  {expertsLoading ? (
                    <div className="text-white/40 text-sm">Loading...</div>
                  ) : (
                    <>
                      {companionsWithExperts.length > 0 && (
                        <div className="mb-8">
                          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">Companion Experts</h3>
                          <div className="space-y-2">
                            {companionsWithExperts.map(c => (
                              <div key={c.id} className="flex items-center justify-between rounded-xl p-4 border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                <div>
                                  <p className="text-white font-medium">{c.name}</p>
                                  {c.expertName ? (
                                    <p className="text-indigo-400 text-sm">{c.expertName} — {c.expertDomain}</p>
                                  ) : (
                                    <p className="text-white/30 text-sm">No expert attached</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Your Custom Experts</h3>
                        <button
                          onClick={() => navigate('/expert-builder')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create New
                        </button>
                      </div>

                      {userExperts.length === 0 ? (
                        <div className="rounded-xl p-6 border border-white/10 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <Brain className="w-8 h-8 text-white/20 mx-auto mb-3" />
                          <p className="text-white/40 text-sm">You haven't created any custom experts yet.</p>
                          <button
                            onClick={() => navigate('/expert-builder')}
                            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white transition"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
                          >
                            Create Your First Expert
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {userExperts.map(expert => (
                            <div key={expert.id} className="flex items-center justify-between rounded-xl p-4 border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
                              <div className="min-w-0 flex-1">
                                <p className="text-white font-medium">{expert.name}</p>
                                <p className="text-white/40 text-sm truncate">{expert.domain} — {expert.description}</p>
                              </div>
                              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                <button
                                  onClick={() => navigate(`/expert-builder?edit=${expert.id}`)}
                                  className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteExpert(expert.id)}
                                  className="p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'data' && (
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-white mb-1">My Data</h2>
                  <p className="text-white/40 text-sm mb-6">Export or delete your personal data. This is your right under GDPR and similar privacy laws.</p>

                  <div className="space-y-4 mb-8">
                    <div className="rounded-xl p-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center mt-0.5" style={{ background: 'rgba(59,130,246,0.15)' }}>
                            <Download className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium mb-1">Export Your Data</p>
                            <p className="text-white/40 text-sm">Download a complete copy of your profile, conversations, memories, calendar events, and usage data as a JSON file.</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        {exportDone ? (
                          <div className="flex items-center gap-2 text-emerald-400 text-sm">
                            <Check className="w-4 h-4" />
                            Export downloaded successfully
                          </div>
                        ) : (
                          <button
                            onClick={handleExport}
                            disabled={exportLoading}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
                          >
                            {exportLoading ? 'Preparing export...' : 'Download My Data'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl p-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mt-0.5" style={{ background: 'rgba(239,68,68,0.15)' }}>
                          <Trash2 className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium mb-1">Delete My Account</p>
                          <p className="text-white/40 text-sm">Permanently delete your account and all associated data. This action cannot be undone. Your data will be removed within 30 days.</p>
                        </div>
                      </div>

                      {deleteMessage && (
                        <div className={`mt-4 p-3 rounded-lg text-sm ${
                          deleteMessage.type === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {deleteMessage.text}
                        </div>
                      )}

                      {!deleteConfirm && !deleteMessage?.type.includes('success') && (
                        <button
                          onClick={() => setDeleteConfirm(true)}
                          className="mt-4 px-5 py-2.5 rounded-xl text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition"
                        >
                          Request Account Deletion
                        </button>
                      )}

                      {deleteConfirm && (
                        <div className="mt-4 p-4 rounded-xl border border-red-500/20" style={{ background: 'rgba(239,68,68,0.08)' }}>
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <p className="text-red-300 text-sm font-medium">This cannot be undone</p>
                          </div>
                          <p className="text-white/50 text-sm mb-3">
                            Type <span className="text-red-400 font-mono">delete my account</span> to confirm.
                          </p>
                          <input
                            type="text"
                            value={deleteInput}
                            onChange={e => setDeleteInput(e.target.value)}
                            placeholder="delete my account"
                            className="w-full bg-black/20 border border-red-500/20 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-red-500/50 mb-3"
                          />
                          <div className="flex gap-3">
                            <button
                              onClick={() => { setDeleteConfirm(false); setDeleteInput(''); }}
                              className="flex-1 px-4 py-2 rounded-lg text-sm text-white/60 border border-white/10 hover:bg-white/5 transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleDeleteRequest}
                              disabled={deleteInput.toLowerCase() !== 'delete my account' || deleteLoading}
                              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition disabled:opacity-40"
                            >
                              {deleteLoading ? 'Submitting...' : 'Confirm Deletion'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl p-4 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-white/50 text-xs leading-relaxed">
                      Under GDPR, CCPA, and similar privacy regulations, you have the right to access, export,
                      and delete your personal data. For any data-related requests or questions, contact us at{' '}
                      <a href="mailto:privacy@velvet.app" className="text-blue-400 hover:underline">privacy@velvet.app</a>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-white/5">
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 text-white/40 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-white text-sm font-medium">{label}</p>
          <p className="text-white/40 text-xs mt-0.5">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${
          value ? 'bg-rose-500' : 'bg-white/20'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-white/50 text-xs mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30 pr-11"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function SaveButton({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="mt-8 flex items-center gap-3">
      <button
        onClick={onSave}
        disabled={saving}
        className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #f43f6b, #e11d48)' }}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
      {saved && (
        <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
          <Check className="w-4 h-4" />
          Saved
        </div>
      )}
    </div>
  );
}
