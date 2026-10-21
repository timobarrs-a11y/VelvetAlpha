import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, Eye, EyeOff, Target, Check, Users, Bot, Search, UserRound,
} from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import {
  getMyMemberProfile,
  upsertMyMemberProfile,
  MemberProfile,
} from '../services/memberProfileService';
import { getGoals, CoachingGoal } from '../services/coachingService';
import { toast } from '../shared/ui/Toast';
import { SMILIES, smilieUrl } from '../config/smilieRegistry';
import { PublicProfileImage } from './PublicProfileImage';

export function PublicProfileSettings() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [goals, setGoals] = useState<CoachingGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [discoverable, setDiscoverable] = useState(true);
  const [sharedGoalIds, setSharedGoalIds] = useState<string[]>([]);
  const [profileImageType, setProfileImageType] = useState<'avatar' | 'smilie'>('avatar');
  const [profileSmilieCode, setProfileSmilieCode] = useState<string | null>(null);
  const [smilieSearch, setSmilieSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [p, userGoals] = await Promise.all([getMyMemberProfile(), getGoals(await getCurrentUserId())]);
    setProfile(p);
    setGoals(userGoals);
    if (p) {
      setDisplayName(p.display_name);
      setHeadline(p.headline ?? '');
      setBio(p.bio ?? '');
      setIsPublic(p.is_public);
      setDiscoverable(p.discoverable);
      setSharedGoalIds(p.shared_goal_ids);
      setProfileImageType(p.profile_image_type ?? 'avatar');
      setProfileSmilieCode(p.profile_smilie_code ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (profileImageType === 'smilie' && (!profileSmilieCode || !smilieUrl(profileSmilieCode))) {
      toast.error('Choose a smiley for your public profile picture.');
      return;
    }
    setSaving(true);
    try {
      const updated = await upsertMyMemberProfile({
        display_name: displayName || 'Member',
        headline: headline || null,
        bio: bio || null,
        is_public: isPublic,
        discoverable,
        shared_goal_ids: sharedGoalIds,
        profile_image_type: profileImageType,
        profile_smilie_code: profileImageType === 'smilie' ? profileSmilieCode : null,
      });
      setProfile(updated);
      toast.success('Public profile saved.');
    } catch {
      toast.error('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const filteredSmilies = smilieSearch.trim()
    ? SMILIES.filter(s => s.code.includes(smilieSearch.toLowerCase()) || s.label.toLowerCase().includes(smilieSearch.toLowerCase()))
    : SMILIES;

  const toggleGoalShare = (goalId: string) => {
    setSharedGoalIds(prev =>
      prev.includes(goalId)
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Public toggle */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: isPublic ? 'rgba(244,114,182,0.15)' : 'rgba(255,255,255,0.05)' }}>
              {isPublic ? <Eye className="w-5 h-5 text-pink-400" /> : <EyeOff className="w-5 h-5 text-white/40" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Public profile</h3>
              <p className="text-xs text-white/40 mt-0.5">
                {isPublic ? 'Other members can see your profile' : 'Your profile is private'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
            style={{ background: isPublic ? 'rgba(244,114,182,0.80)' : 'rgba(255,255,255,0.12)' }}
          >
            <motion.div
              animate={{ x: isPublic ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
            />
          </button>
        </div>
      </div>

      {/* Profile picture */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-pink-500/10">
            <UserRound className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Public profile picture</h3>
            <p className="text-xs text-white/40 mt-0.5">Choose what other members see on your page.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setProfileImageType('avatar')}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${profileImageType === 'avatar' ? 'border-pink-400/40 bg-pink-500/10' : 'border-white/8 bg-white/[0.02] hover:border-white/15'}`}
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
              {profile ? <PublicProfileImage profile={profile} className="h-full w-full" /> : <UserRound className="w-full h-full p-2 text-white/40" />}
            </div>
            <span className="text-xs font-semibold text-white/70">Avatar face</span>
          </button>
          <button
            type="button"
            onClick={() => setProfileImageType('smilie')}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${profileImageType === 'smilie' ? 'border-pink-400/40 bg-pink-500/10' : 'border-white/8 bg-white/[0.02] hover:border-white/15'}`}
          >
            {profileSmilieCode && smilieUrl(profileSmilieCode) ? <img src={smilieUrl(profileSmilieCode) ?? ''} alt="" className="w-8 h-8 object-contain" /> : <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-lg">?</span>}
            <span className="text-xs font-semibold text-white/70">Smiley</span>
          </button>
        </div>
        {profileImageType === 'smilie' && (
          <div>
            <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 mb-2">
              <Search className="w-3.5 h-3.5 text-white/30" />
              <input value={smilieSearch} onChange={e => setSmilieSearch(e.target.value)} placeholder="Search the smiley list" className="flex-1 bg-transparent text-xs text-white outline-none placeholder-white/30" />
            </div>
            <div className="grid grid-cols-7 gap-1 max-h-56 overflow-y-auto rounded-lg border border-white/8 p-2">
              {filteredSmilies.map(smilie => (
                <button key={smilie.code} type="button" onClick={() => setProfileSmilieCode(smilie.code)} title={smilie.label} className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${profileSmilieCode === smilie.code ? 'bg-pink-500/20 ring-1 ring-pink-400/50' : 'hover:bg-white/8'}`}>
                  <img src={`/smilies/${smilie.file}`} alt={smilie.label} className="max-h-6 max-w-7 object-contain" loading="lazy" />
                </button>
              ))}
            </div>
            {filteredSmilies.length === 0 && <p className="text-xs text-white/30 text-center py-4">No smileys found.</p>}
          </div>
        )}
      </div>

      {/* Profile fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-white/40 uppercase tracking-wide mb-1.5">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/5 border border-white/10 text-white outline-none focus:border-pink-400/40"
            placeholder="Your public name"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-white/40 uppercase tracking-wide mb-1.5">Headline</label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={80}
            className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/5 border border-white/10 text-white outline-none focus:border-pink-400/40"
            placeholder="One line about you"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-white/40 uppercase tracking-wide mb-1.5">Bio (max 500 chars)</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full rounded-xl px-4 py-2.5 text-sm bg-white/5 border border-white/10 text-white outline-none focus:border-pink-400/40 resize-none"
            placeholder="Tell other members about your journey"
          />
          <p className="text-xs text-white/30 mt-1 text-right tabular-nums">{bio.length}/500</p>
        </div>
      </div>

      {/* Discoverable toggle */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5">
              <Users className="w-5 h-5 text-white/40" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Discoverable</h3>
              <p className="text-xs text-white/40 mt-0.5">Appear in discovery and Atlas introductions</p>
            </div>
          </div>
          <button
            onClick={() => setDiscoverable(!discoverable)}
            className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
            style={{ background: discoverable ? 'rgba(244,114,182,0.80)' : 'rgba(255,255,255,0.12)' }}
          >
            <motion.div
              animate={{ x: discoverable ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
            />
          </button>
        </div>
      </div>

      {/* Goal sharing */}
      <div>
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" />
          Share goals publicly
        </h3>
        <p className="text-xs text-white/30 mb-3">Choose which goals appear on your public profile. Progress is shown automatically.</p>
        {goals.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-6 text-center">
            <p className="text-white/30 text-sm">No goals yet. Your coach can help you create one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {goals.map(goal => {
              const shared = sharedGoalIds.includes(goal.id);
              return (
                <button
                  key={goal.id}
                  onClick={() => toggleGoalShare(goal.id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                    shared ? 'bg-pink-500/10 border border-pink-400/30' : 'bg-white/[0.02] border border-white/8 hover:border-white/15'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                    shared ? 'bg-pink-500 text-white' : 'border border-white/20'
                  }`}>
                    {shared && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{goal.title}</p>
                    <p className="text-xs text-white/40 mt-0.5 capitalize">{goal.goal_type.replace(/_/g, ' ')}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save public profile'}
      </button>

      {profile?.is_bot && (
        <div className="flex items-center gap-2 text-xs text-sky-300/60 justify-center">
          <Bot className="w-3.5 h-3.5" />
          This is a bot account
        </div>
      )}
    </div>
  );
}

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? '';
}
