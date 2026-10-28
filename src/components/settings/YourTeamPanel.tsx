import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { getCompanions, deleteCompanion, type CompanionWithLastMessage } from '../../services/companionService';
import { helperRole, isHelper } from '../../utils/relationshipType';
import { SOMEONE_NEW_ROUTE } from '../../services/setupProgressService';
import { ModalShell, Button, toast } from '../../shared/ui';

/** What goes when someone is deleted, in plain words, for the confirmation. */
function whatGoes(c: CompanionWithLastMessage): string {
  if (isHelper(c.relationship_type)) {
    return `Your chats with ${c.custom_name}, everything they remember about you, and their commitments are deleted. Your goals and plans stay, and you can bring in a new ${helperRole(c.relationship_type)!.toLowerCase()} for them.`;
  }
  return `Your chats with ${c.custom_name}, everything they remember about you, and your Velvet Sims house together are deleted.`;
}

/** Settings → Your team: everyone you've made, with a way to delete each for good (and make someone new). */
export function YourTeamPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [people, setPeople] = useState<CompanionWithLastMessage[] | null>(null);
  const [confirming, setConfirming] = useState<CompanionWithLastMessage | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!user?.id) return;
    getCompanions(user.id).then(setPeople).catch(() => setPeople([]));
  }, [user?.id]);
  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    if (!confirming) return;
    setBusy(true);
    const err = await deleteCompanion(confirming.id);
    setBusy(false);
    if (err) { toast.error('Could not delete them. Try again.'); return; }
    toast.success(`${confirming.custom_name} is deleted.`);
    setConfirming(null);
    load();
  };

  const helpers = (people ?? []).filter((c) => isHelper(c.relationship_type));
  const companions = (people ?? []).filter((c) => !isHelper(c.relationship_type));

  const row = (c: CompanionWithLastMessage) => (
    <div key={c.id} className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{c.custom_name}</p>
        <p className="text-white/40 text-xs">{helperRole(c.relationship_type) ?? 'Companion'}</p>
      </div>
      <button
        type="button"
        onClick={() => setConfirming(c)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-300 border border-red-500/30 hover:bg-red-500/10 transition-colors"
        aria-label={`Delete ${c.custom_name}`}
      >
        <Trash2 className="w-3.5 h-3.5" /> Delete
      </button>
    </div>
  );

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-white mb-1">Your team</h2>
      <p className="text-white/40 text-sm mb-6">Everyone you've made. Deleting someone is permanent.</p>

      {people === null && <p className="text-white/40 text-sm">Loading...</p>}
      {people && people.length === 0 && <p className="text-white/40 text-sm">No one yet.</p>}

      {companions.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">Companions</h3>
          <div className="space-y-2">{companions.map(row)}</div>
        </div>
      )}
      {helpers.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">Coaches and assistants</h3>
          <div className="space-y-2">{helpers.map(row)}</div>
        </div>
      )}

      {people && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" leftIcon={<UserPlus className="w-4 h-4" />} onClick={() => navigate(SOMEONE_NEW_ROUTE)}>Make a new companion</Button>
          <Button variant="secondary" size="sm" leftIcon={<UserPlus className="w-4 h-4" />} onClick={() => navigate('/atlas')}>Get a new coach with Atlas</Button>
        </div>
      )}

      <ModalShell isOpen={!!confirming} onClose={() => !busy && setConfirming(null)} title={confirming ? `Delete ${confirming.custom_name} permanently?` : ''} size="sm">
        {confirming && (
          <>
            <p className="text-sm text-ink-muted mb-3">{whatGoes(confirming)}</p>
            <p className="text-sm font-semibold text-red-300 mb-6">This is permanent and can't be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirming(null)} disabled={busy}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={remove} isLoading={busy}>Delete permanently</Button>
            </div>
          </>
        )}
      </ModalShell>
    </div>
  );
}
