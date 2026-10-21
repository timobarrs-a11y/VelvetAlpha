import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Users } from 'lucide-react';
import { getInvitePreview, redeemSpaceInvite } from '../services/spacesService';
import type { InvitePreview } from '../types/spaces';
import { SpaceIcon } from '../components/house/SpaceIcon';
import { useAuth } from '../auth/AuthProvider';
import { toast } from '../shared/ui/Toast';

export default function JoinInvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!code) return;
    getInvitePreview(code)
      .then(p => setPreview(p))
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [code]);

  const handleJoin = async () => {
    if (!code) return;
    if (!user) {
      navigate('/lobby');
      return;
    }
    setJoining(true);
    try {
      const boardId = await redeemSpaceInvite(code);
      toast.success('You\'re in!');
      navigate(`/house/${boardId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="ds-page text-white flex flex-col items-center justify-center h-full">
        <p className="text-sm text-ink-muted">Checking invite...</p>
      </div>
    );
  }

  if (!preview || !preview.is_valid) {
    return (
      <div className="ds-page text-white flex flex-col items-center justify-center h-full p-6 text-center">
        <AlertCircle className="w-10 h-10 text-ink-muted mb-4" />
        <h1 className="text-lg font-bold text-ink mb-1">Invite expired</h1>
        <p className="text-sm text-ink-muted max-w-xs">
          This invite link has expired or been used up. Ask a member for a new one.
        </p>
      </div>
    );
  }

  return (
    <div className="ds-page text-white flex flex-col items-center justify-center h-full p-6">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <span className="inline-flex w-16 h-16 rounded-2xl bg-white/5 items-center justify-center mb-4">
            <SpaceIcon name={preview.icon} color={preview.color} className="w-8 h-8" />
          </span>
          <h1 className="text-xl font-bold text-ink mb-1">{preview.name}</h1>
          {preview.description && (
            <p className="text-sm text-ink-muted mb-3">{preview.description}</p>
          )}
          <div className="flex items-center justify-center gap-1.5 text-xs text-ink-muted mb-5">
            <Users className="w-3.5 h-3.5" />
            <span>{preview.member_count} members</span>
          </div>
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {joining ? 'Joining...' : user ? 'Join space' : 'Sign in to join'}
          </button>
        </div>
        <p className="text-center text-xs text-ink-muted/50 mt-4">
          You'll be added as a member instantly.
        </p>
      </div>
    </div>
  );
}
