import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Settings, Users, Mail, Tag, MessageSquare, ChevronUp, ChevronDown,
  Trash2, Plus, Copy, Check, UserCog, Crown, Ban,
} from 'lucide-react';
import {
  getSpaceMembers, getJoinRequests, decideJoinRequest, createSpaceInvite,
  getInvites, revokeInvite, setMemberRole, transferSpaceOwnership,
  removeSpaceMember, unbanSpaceMember, updateSpaceSettings,
  getRoleTags, createRoleTag, deleteRoleTag, assignMemberTag, removeMemberTag,
  getRooms, createRoom, deleteRoom, updateRoom, reorderRoom,
} from '../../services/spacesService';
import type { SpaceMember, JoinRequest, InviteRow, RoleTag, SpaceRoom, SpaceVisibility } from '../../types/spaces';
import { SpaceIcon } from './SpaceIcon';
import { toast } from '../../shared/ui/Toast';
import { useAuth } from '../../auth/AuthProvider';

const ICON_OPTIONS = ['Gamepad2', 'Coffee', 'Dumbbell', 'Film', 'Music', 'BookOpen', 'Palette', 'Trophy', 'Heart', 'Cpu'];
const COLOR_OPTIONS = ['pink', 'rose', 'amber', 'blue', 'emerald', 'violet', 'teal', 'green'];
const TAG_COLORS = ['#fb7185', '#38bdf8', '#fbbf24', '#a78bfa', '#34d399', '#f97316', '#ec4899', '#22d3ee'];

type Tab = 'general' | 'rooms' | 'members' | 'requests' | 'invites' | 'tags';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  boardName: string;
  boardIcon: string;
  boardColor: string;
  boardDescription: string;
  boardVisibility: SpaceVisibility;
  isOwner: boolean;
  initialTab?: Tab;
}

export function SpaceSettingsModal({
  isOpen, onClose, boardId, boardName, boardIcon, boardColor,
  boardDescription, boardVisibility, isOwner, initialTab = 'general',
}: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const canMod = isOwner;

  useEffect(() => { setTab(initialTab); }, [initialTab, isOpen]);

  const TABS: { key: Tab; label: string; icon: typeof Settings; ownerOnly?: boolean }[] = [
    { key: 'general', label: 'General', icon: Settings },
    { key: 'rooms', label: 'Rooms', icon: MessageSquare },
    { key: 'members', label: 'Members', icon: Users },
    { key: 'requests', label: 'Requests', icon: Mail },
    { key: 'invites', label: 'Invites', icon: Mail },
    { key: 'tags', label: 'Tags', icon: Tag },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[85vh] rounded-2xl border border-white/10 bg-[var(--ds-surface-2)] shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
              <div className="flex items-center gap-2">
                <SpaceIcon name={boardIcon} color={boardColor} className="w-4 h-4" />
                <h2 className="text-sm font-bold text-ink">{boardName} settings</h2>
              </div>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
                <X className="w-4 h-4 text-ink-muted" />
              </button>
            </div>

            <div className="flex gap-1 px-4 py-2 border-b border-white/8 flex-shrink-0">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    tab === t.key ? 'bg-white/10 text-ink' : 'text-ink-muted hover:text-ink hover:bg-white/5'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {tab === 'general' && (
                <GeneralTab
                  boardId={boardId}
                  name={boardName}
                  description={boardDescription}
                  icon={boardIcon}
                  color={boardColor}
                  visibility={boardVisibility}
                  canMod={canMod}
                />
              )}
              {tab === 'rooms' && <RoomsTab boardId={boardId} canMod={canMod} />}
              {tab === 'members' && <MembersTab boardId={boardId} isOwner={isOwner} currentUserId={user?.id ?? ''} />}
              {tab === 'requests' && <RequestsTab boardId={boardId} />}
              {tab === 'invites' && <InvitesTab boardId={boardId} />}
              {tab === 'tags' && <TagsTab boardId={boardId} canMod={canMod} />}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ===== General Tab ===== */
function GeneralTab({ boardId, name, description, icon, color, visibility, canMod }: {
  boardId: string; name: string; description: string; icon: string;
  color: string; visibility: SpaceVisibility; canMod: boolean;
}) {
  const [formName, setFormName] = useState(name);
  const [formDesc, setFormDesc] = useState(description);
  const [formIcon, setFormIcon] = useState(icon);
  const [formColor, setFormColor] = useState(color);
  const [formVis, setFormVis] = useState<SpaceVisibility>(visibility);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSpaceSettings({
        boardId,
        name: formName !== name ? formName : null,
        description: formDesc !== description ? formDesc : null,
        icon: formIcon !== icon ? formIcon : null,
        color: formColor !== color ? formColor : null,
        visibility: formVis !== visibility ? formVis : null,
      });
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className="text-xs font-medium text-ink-muted mb-1.5 block">Name</label>
        <input
          value={formName}
          onChange={e => setFormName(e.target.value)}
          disabled={!canMod}
          maxLength={50}
          className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors disabled:opacity-50"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-ink-muted mb-1.5 block">Description</label>
        <input
          value={formDesc}
          onChange={e => setFormDesc(e.target.value)}
          disabled={!canMod}
          maxLength={200}
          className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors disabled:opacity-50"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-ink-muted mb-1.5 block">Icon</label>
        <div className="flex flex-wrap gap-2">
          {ICON_OPTIONS.map(ic => (
            <button
              key={ic}
              onClick={() => setFormIcon(ic)}
              disabled={!canMod}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
                formIcon === ic ? 'bg-white/15 ring-1 ring-white/20' : 'bg-white/5 hover:bg-white/8'
              }`}
            >
              <SpaceIcon name={ic} color={formColor} className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-ink-muted mb-1.5 block">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map(c => (
            <button
              key={c}
              onClick={() => setFormColor(c)}
              disabled={!canMod}
              className={`w-7 h-7 rounded-full transition-all disabled:opacity-50 ${
                formColor === c ? 'ring-2 ring-white/30 scale-110' : 'opacity-60 hover:opacity-100'
              }`}
            >
              <SpaceIcon name={formIcon} color={c} className="w-4 h-4 m-auto" />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-ink-muted mb-1.5 block">Door</label>
        <select
          value={formVis}
          onChange={e => setFormVis(e.target.value as SpaceVisibility)}
          disabled={!canMod}
          className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-ink outline-none focus:bg-white/8 transition-colors disabled:opacity-50"
        >
          <option value="open">Open — anyone can join</option>
          <option value="request">Request — you approve</option>
          <option value="invite">Invite only — link required</option>
          <option value="private">Private — owners add people</option>
        </select>
      </div>
      {canMod && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      )}
    </div>
  );
}

/* ===== Rooms Tab ===== */
function RoomsTab({ boardId, canMod }: { boardId: string; canMod: boolean }) {
  const [rooms, setRooms] = useState<SpaceRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [newKind, setNewKind] = useState<'chat' | 'announcements'>('chat');
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    getRooms(boardId).then(setRooms).catch(() => {}).finally(() => setLoading(false));
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const slug = slugify(newName);
    if (!slug) return;
    try {
      await createRoom(boardId, slug, newTopic.trim() || null, newKind);
      setNewName(''); setNewTopic(''); setNewKind('chat'); setShowAdd(false);
      load();
      toast.success('Room created');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create room');
    }
  };

  const handleDelete = async (roomId: string, roomName: string) => {
    if (roomName === 'general') { toast.error('#general can\'t be deleted'); return; }
    if (!confirm(`Delete #${roomName}?`)) return;
    try {
      await deleteRoom(roomId);
      load();
      toast.success('Room deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  if (loading) return <div className="p-5 text-sm text-ink-muted">Loading...</div>;

  return (
    <div className="p-5 space-y-2">
      {rooms.map(room => (
        <div key={room.id} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/8">
          <span className="text-sm text-ink flex-1">#{room.name}</span>
          {room.kind === 'announcements' && (
            <span className="text-[9px] uppercase tracking-wider text-amber-400/70">Ann</span>
          )}
          {canMod && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => reorderRoom(room.id, 'up').then(load).catch(() => {})}
                className="p-1 rounded text-ink-muted hover:text-ink hover:bg-white/5"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => reorderRoom(room.id, 'down').then(load).catch(() => {})}
                className="p-1 rounded text-ink-muted hover:text-ink hover:bg-white/5"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {room.name !== 'general' && (
                <button
                  onClick={() => handleDelete(room.id, room.name)}
                  className="p-1 rounded text-ink-muted hover:text-rose-400 hover:bg-white/5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      {canMod && (
        <>
          {showAdd ? (
            <div className="p-3 rounded-xl bg-white/5 border border-white/8 space-y-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="room-name (lowercase, no spaces)"
                maxLength={32}
                className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
              />
              <input
                value={newTopic}
                onChange={e => setNewTopic(e.target.value)}
                placeholder="Topic (optional)"
                maxLength={100}
                className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
              />
              <select
                value={newKind}
                onChange={e => setNewKind(e.target.value as 'chat' | 'announcements')}
                className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-ink outline-none focus:bg-white/8 transition-colors"
              >
                <option value="chat">Chat</option>
                <option value="announcements">Announcements</option>
              </select>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg text-sm text-ink-muted hover:text-ink transition-colors">Cancel</button>
                <button onClick={handleAdd} disabled={!newName.trim()} className="flex-1 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium transition-colors disabled:opacity-50">Add</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 border border-dashed border-white/10 text-sm text-ink-muted hover:text-ink hover:bg-white/8 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add room
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ===== Members Tab ===== */
function MembersTab({ boardId, isOwner, currentUserId }: { boardId: string; isOwner: boolean; currentUserId: string }) {
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [tags, setTags] = useState<RoleTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTagMenu, setShowTagMenu] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([getSpaceMembers(boardId), getRoleTags(boardId)])
      .then(([m, t]) => { setMembers(m); setTags(t); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  const handleSetRole = async (userId: string, role: 'mod' | 'member') => {
    try {
      await setMemberRole(boardId, userId, role);
      load();
      toast.success('Role updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleTransfer = async (userId: string) => {
    if (!confirm('Transfer ownership? You will become a mod.')) return;
    try {
      await transferSpaceOwnership(boardId, userId);
      load();
      toast.success('Ownership transferred');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleRemove = async (userId: string, ban: boolean) => {
    const msg = ban ? 'Remove and ban this member?' : 'Remove this member?';
    if (!confirm(msg)) return;
    try {
      await removeSpaceMember(boardId, userId, ban);
      load();
      toast.success(ban ? 'Member banned' : 'Member removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading) return <div className="p-5 text-sm text-ink-muted">Loading...</div>;

  return (
    <div className="p-5 space-y-2">
      {members.map(m => {
        const isMe = m.user_id === currentUserId;
        return (
          <div key={m.user_id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-xs text-white font-bold flex-shrink-0">
              {m.display_name.charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-ink truncate">{m.display_name}</span>
                {m.role === 'owner' && <Crown className="w-3 h-3 text-amber-400" />}
                {m.role === 'mod' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">Mod</span>}
                {m.tags[0] && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                    style={{ backgroundColor: `${m.tags[0].color}20`, color: m.tags[0].color }}
                  >
                    {m.tags[0].name}
                  </span>
                )}
              </div>
            </div>
            {isOwner && !isMe && m.role !== 'owner' && (
              <div className="flex items-center gap-1">
                {m.role === 'member' ? (
                  <button
                    onClick={() => handleSetRole(m.user_id, 'mod')}
                    className="p-1 rounded text-ink-muted hover:text-blue-400 hover:bg-white/5"
                    title="Make mod"
                  >
                    <UserCog className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSetRole(m.user_id, 'member')}
                    className="text-[10px] px-2 py-1 rounded text-ink-muted hover:text-ink hover:bg-white/5"
                  >
                    Demote
                  </button>
                )}
                <button
                  onClick={() => handleTransfer(m.user_id)}
                  className="text-[10px] px-2 py-1 rounded text-ink-muted hover:text-amber-400 hover:bg-white/5"
                >
                  Transfer
                </button>
                <button
                  onClick={() => handleRemove(m.user_id, false)}
                  className="p-1 rounded text-ink-muted hover:text-rose-400 hover:bg-white/5"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleRemove(m.user_id, true)}
                  className="p-1 rounded text-ink-muted hover:text-rose-500 hover:bg-white/5"
                  title="Ban"
                >
                  <Ban className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {isOwner && !isMe && tags.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowTagMenu(showTagMenu === m.user_id ? null : m.user_id)}
                  className="p-1 rounded text-ink-muted hover:text-ink hover:bg-white/5"
                >
                  <Tag className="w-3.5 h-3.5" />
                </button>
                {showTagMenu === m.user_id && (
                  <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-white/10 bg-[var(--ds-surface-2)] shadow-xl z-20 py-1">
                    {tags.map(t => {
                      const has = m.tags.some(mt => mt.id === t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={async () => {
                            try {
                              if (has) await removeMemberTag(boardId, m.user_id, t.id);
                              else await assignMemberTag(boardId, m.user_id, t.id);
                              load();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Failed');
                            }
                            setShowTagMenu(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ink hover:bg-white/5 transition-colors"
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.name}
                          {has && <Check className="w-3 h-3 ml-auto text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ===== Requests Tab ===== */
function RequestsTab({ boardId }: { boardId: string }) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getJoinRequests(boardId).then(setRequests).catch(() => {}).finally(() => setLoading(false));
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  const handle = async (reqId: string, approve: boolean) => {
    setBusy(reqId);
    try {
      await decideJoinRequest(reqId, approve);
      setRequests(prev => prev.filter(r => r.id !== reqId));
      toast.success(approve ? 'Approved' : 'Declined');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="p-5 text-sm text-ink-muted">Loading...</div>;

  if (requests.length === 0) {
    return <div className="p-5 text-center text-sm text-ink-muted">No pending requests.</div>;
  }

  return (
    <div className="p-5 space-y-2">
      {requests.map(r => (
        <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
          <span className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-xs text-white font-bold flex-shrink-0">
            {r.display_name.charAt(0).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-ink block">{r.display_name}</span>
            {r.message && <span className="text-xs text-ink-muted truncate block">{r.message}</span>}
          </div>
          <button
            onClick={() => handle(r.id, true)}
            disabled={busy === r.id}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-xs text-emerald-300 border border-emerald-500/30 transition-colors disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => handle(r.id, false)}
            disabled={busy === r.id}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-ink-muted transition-colors disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      ))}
    </div>
  );
}

/* ===== Invites Tab ===== */
function InvitesTab({ boardId }: { boardId: string }) {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxUses, setMaxUses] = useState<number | null>(null);
  const [expires, setExpires] = useState<number | null>(168);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    getInvites(boardId).then(setInvites).catch(() => {}).finally(() => setLoading(false));
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createSpaceInvite(boardId, maxUses, expires);
      load();
      toast.success('Invite created');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (code: string) => {
    const link = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleRevoke = async (code: string) => {
    if (!confirm('Revoke this invite?')) return;
    try {
      await revokeInvite(code);
      load();
      toast.success('Invite revoked');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div className="p-5 space-y-4">
      <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/8">
        <div className="flex gap-2">
          <select
            value={maxUses === null ? 0 : maxUses}
            onChange={e => setMaxUses(e.target.value === '0' ? null : Number(e.target.value))}
            className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-sm text-ink outline-none focus:bg-white/8 transition-colors"
          >
            <option value={0}>Unlimited uses</option>
            <option value={1}>1 use</option>
            <option value={10}>10 uses</option>
          </select>
          <select
            value={expires === null ? 0 : expires}
            onChange={e => setExpires(e.target.value === '0' ? null : Number(e.target.value))}
            className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-sm text-ink outline-none focus:bg-white/8 transition-colors"
          >
            <option value={168}>7 days</option>
            <option value={24}>1 day</option>
            <option value={0}>Never expires</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create invite link'}
        </button>
      </div>

      {loading && <p className="text-sm text-ink-muted text-center">Loading...</p>}

      {!loading && invites.length > 0 && (
        <div className="space-y-2">
          {invites.map(inv => (
            <div key={inv.code} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/8">
              <code className="flex-1 text-xs text-ink-muted truncate">/join/{inv.code}</code>
              <span className="text-[10px] text-ink-muted">
                {inv.uses}{inv.max_uses ? `/${inv.max_uses}` : ''} uses
              </span>
              {inv.revoked && <span className="text-[10px] text-rose-400">Revoked</span>}
              {!inv.revoked && (
                <>
                  <button
                    onClick={() => handleCopy(inv.code)}
                    className="p-1 rounded text-ink-muted hover:text-ink hover:bg-white/5"
                    title="Copy link"
                  >
                    {copied === inv.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleRevoke(inv.code)}
                    className="p-1 rounded text-ink-muted hover:text-rose-400 hover:bg-white/5"
                    title="Revoke"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== Tags Tab ===== */
function TagsTab({ boardId, canMod }: { boardId: string; canMod: boolean }) {
  const [tags, setTags] = useState<RoleTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);

  const load = useCallback(() => {
    getRoleTags(boardId).then(setTags).catch(() => {}).finally(() => setLoading(false));
  }, [boardId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createRoleTag(boardId, newName.trim(), newColor);
      setNewName('');
      load();
      toast.success('Tag created');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleDelete = async (tagId: string) => {
    if (!confirm('Delete this tag?')) return;
    try {
      await deleteRoleTag(tagId);
      load();
      toast.success('Tag deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  if (loading) return <div className="p-5 text-sm text-ink-muted">Loading...</div>;

  return (
    <div className="p-5 space-y-3">
      {tags.map(t => (
        <div key={t.id} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/8">
          <span
            className="text-xs px-2 py-1 rounded font-medium"
            style={{ backgroundColor: `${t.color}20`, color: t.color }}
          >
            {t.name}
          </span>
          <div className="flex-1" />
          {canMod && (
            <button
              onClick={() => handleDelete(t.id)}
              className="p-1 rounded text-ink-muted hover:text-rose-400 hover:bg-white/5"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      {canMod && (
        <div className="flex gap-2 p-3 rounded-xl bg-white/5 border border-white/8">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Tag name"
            maxLength={24}
            className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
          />
          <div className="flex gap-1">
            {TAG_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full transition-all ${newColor === c ? 'ring-2 ring-white/30 scale-110' : 'opacity-60 hover:opacity-100'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="px-3 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
