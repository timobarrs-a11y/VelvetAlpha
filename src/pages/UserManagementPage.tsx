import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  User,
  Search,
  ChevronDown,
  BarChart3,
  Crown,
  Users,
  AlertTriangle,
  RefreshCw,
  Mail,
  Calendar,
  MessageCircle,
  Filter,
  Download,
  Eye,
  Ban,
  CheckCircle,
} from 'lucide-react';
import { roleService, UserRole, UserWithRole } from '../services/roleService';
import { supabase } from '../shared/supabase/client';

type FilterRole = 'all' | UserRole;
type FilterTier = 'all' | 'free' | 'trial' | 'unlimited' | 'starter' | 'plus' | 'elite';
type SortField = 'name' | 'created_at' | 'subscription_tier' | 'user_role';

interface UserDetail extends UserWithRole {
  message_count?: number;
  last_active?: string;
  email?: string;
}

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string; border: string; icon: typeof Shield }> = {
  admin:   { label: 'Admin',   color: 'text-amber-300', bg: 'bg-amber-500/15',  border: 'border-amber-500/30',  icon: ShieldCheck },
  manager: { label: 'Manager', color: 'text-sky-300',   bg: 'bg-sky-500/15',    border: 'border-sky-500/30',    icon: Shield },
  user:    { label: 'User',    color: 'text-white/60',  bg: 'bg-white/5',       border: 'border-white/10',      icon: User },
};

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  free:      { label: 'Free',      color: 'text-white/50',  bg: 'bg-white/5' },
  trial:     { label: 'Trial',     color: 'text-cyan-400',  bg: 'bg-cyan-500/15' },
  unlimited: { label: 'Unlimited', color: 'text-sky-400',   bg: 'bg-sky-500/15' },
  starter:   { label: 'Starter',   color: 'text-green-400', bg: 'bg-green-500/15' },
  plus:      { label: 'Plus',      color: 'text-amber-400', bg: 'bg-amber-500/15' },
  elite:     { label: 'Elite',     color: 'text-rose-400',  bg: 'bg-rose-500/15' },
};

export function UserManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [changingTier, setChangingTier] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'role' | 'tier';
    userId: string;
    userName: string;
    current: string;
    next: string;
  } | null>(null);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const data = await roleService.getAllUsers();
    setUsers(data as UserDetail[]);

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, [loadUsers]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleRoleChange = (userId: string, userName: string, currentRole: UserRole, newRole: UserRole) => {
    if (currentRole === newRole || userId === currentUserId) return;
    setConfirmDialog({ type: 'role', userId, userName, current: currentRole, next: newRole });
  };

  const handleTierChange = (userId: string, userName: string, currentTier: string, newTier: string) => {
    if (currentTier === newTier) return;
    setConfirmDialog({ type: 'tier', userId, userName, current: currentTier, next: newTier });
  };

  const confirmChange = async () => {
    if (!confirmDialog) return;
    const { type, userId, next } = confirmDialog;
    setConfirmDialog(null);

    if (type === 'role') {
      setChangingRole(userId);
      const success = await roleService.updateUserRole(userId, next as UserRole);
      if (success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, user_role: next as UserRole } : u));
        showStatus('success', `Role updated successfully.`);
      } else {
        showStatus('error', 'Failed to update role.');
      }
      setChangingRole(null);
    } else {
      setChangingTier(userId);
      try {
        const { error } = await supabase
          .from('user_profiles')
          .update({ subscription_tier: next })
          .eq('id', userId);
        if (error) throw error;
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_tier: next } : u));
        showStatus('success', `Subscription tier updated to ${next}.`);
      } catch {
        showStatus('error', 'Failed to update subscription tier.');
      }
      setChangingTier(null);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['ID', 'Name', 'Role', 'Tier', 'Joined'],
      ...filteredSortedUsers.map(u => [
        u.id,
        u.name || 'Unnamed',
        u.user_role,
        u.subscription_tier || 'free',
        new Date(u.created_at).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velvet-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(p => !p);
    else { setSortField(field); setSortAsc(true); }
  };

  const filteredSortedUsers = useMemo(() => {
    let result = users;
    if (filterRole !== 'all') result = result.filter(u => u.user_role === filterRole);
    if (filterTier !== 'all') result = result.filter(u => (u.subscription_tier || 'free') === filterTier);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => u.name?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      let av: any, bv: any;
      if (sortField === 'name') { av = a.name || ''; bv = b.name || ''; }
      else if (sortField === 'created_at') { av = a.created_at; bv = b.created_at; }
      else if (sortField === 'subscription_tier') { av = a.subscription_tier || 'free'; bv = b.subscription_tier || 'free'; }
      else { av = a.user_role; bv = b.user_role; }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [users, filterRole, filterTier, searchQuery, sortField, sortAsc]);

  const roleCounts = useMemo(() => ({
    all: users.length,
    admin: users.filter(u => u.user_role === 'admin').length,
    manager: users.filter(u => u.user_role === 'manager').length,
    user: users.filter(u => u.user_role === 'user').length,
  }), [users]);

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach(u => { const t = u.subscription_tier || 'free'; counts[t] = (counts[t] || 0) + 1; });
    return counts;
  }, [users]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0d1128 0%, #090c1e 100%)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4" />
          <p className="text-white/60">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: 'linear-gradient(180deg, #0d1128 0%, #090c1e 50%, #060810 100%)' }}>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin/analytics')} className="flex items-center gap-2 text-white/60 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">User Management</h1>
              <p className="text-white/40 text-sm">{users.length} total users</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadUsers(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/10 transition text-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => navigate('/admin/analytics')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sky-300 border border-sky-500/30 hover:bg-sky-500/10 transition text-sm"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </button>
          </div>
        </div>

        {/* Status message */}
        {statusMessage && (
          <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {statusMessage.text}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {([
            { key: 'all' as FilterRole, label: 'Total', icon: Users, color: 'text-white' },
            { key: 'admin' as FilterRole, label: 'Admins', icon: ShieldCheck, color: 'text-amber-400' },
            { key: 'manager' as FilterRole, label: 'Managers', icon: Shield, color: 'text-sky-400' },
            { key: 'user' as FilterRole, label: 'Users', icon: User, color: 'text-white/60' },
          ]).map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setFilterRole(filterRole === key && key !== 'all' ? 'all' : key)}
              className={`p-4 rounded-2xl border transition text-left ${
                filterRole === key
                  ? 'border-white/20 bg-white/10'
                  : 'border-white/8 bg-white/4 hover:bg-white/7'
              }`}
              style={{ background: filterRole === key ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)' }}
            >
              <Icon className={`w-5 h-5 ${color} mb-2`} />
              <div className="text-2xl font-bold text-white">{roleCounts[key]}</div>
              <div className="text-xs text-white/40">{label}</div>
            </button>
          ))}
        </div>

        {/* Tier breakdown pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setFilterTier('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              filterTier === 'all' ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 bg-white/5 text-white/40 hover:text-white/60'
            }`}
          >
            All Tiers ({users.length})
          </button>
          {Object.entries(TIER_CONFIG).map(([tier, cfg]) => {
            const count = tierCounts[tier] || 0;
            if (count === 0) return null;
            return (
              <button
                key={tier}
                onClick={() => setFilterTier(filterTier === tier ? 'all' : tier as FilterTier)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  filterTier === tier ? `${cfg.bg} ${cfg.color} border-current/30` : 'border-white/10 bg-white/5 text-white/40 hover:text-white/60'
                }`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search by name or user ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl pl-11 pr-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none transition"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >×</button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/8 text-xs font-medium text-white/35 uppercase tracking-wider">
            {[
              { label: 'User', field: 'name' as SortField, span: 3 },
              { label: 'Role', field: 'user_role' as SortField, span: 2 },
              { label: 'Subscription', field: 'subscription_tier' as SortField, span: 2 },
              { label: 'Joined', field: 'created_at' as SortField, span: 2 },
              { label: 'Actions', field: null, span: 3 },
            ].map(col => (
              <div
                key={col.label}
                className={`col-span-${col.span} ${col.field ? 'cursor-pointer hover:text-white/60 select-none' : ''} flex items-center gap-1`}
                onClick={() => col.field && toggleSort(col.field)}
              >
                {col.label}
                {col.field === sortField && (
                  <span className="text-rose-400">{sortAsc ? '↑' : '↓'}</span>
                )}
              </div>
            ))}
          </div>

          {filteredSortedUsers.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Users className="w-8 h-8 text-white/20 mx-auto mb-3" />
              <p className="text-white/30 text-sm">No users match your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredSortedUsers.map(user => {
                const roleConfig = ROLE_CONFIG[user.user_role];
                const RoleIcon = roleConfig.icon;
                const tierConfig = TIER_CONFIG[user.subscription_tier || 'free'] || TIER_CONFIG.free;
                const isSelf = user.id === currentUserId;
                const isChangingThis = changingRole === user.id || changingTier === user.id;

                return (
                  <div
                    key={user.id}
                    className={`grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 items-center transition ${
                      isSelf ? 'bg-sky-500/5' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* User info */}
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sm text-white/70"
                        style={{ background: 'rgba(255,255,255,0.08)' }}>
                        {(user.name || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-white font-medium text-sm flex items-center gap-1.5 truncate">
                          {user.name || 'Unnamed'}
                          {isSelf && (
                            <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded flex-shrink-0">You</span>
                          )}
                        </div>
                        <div className="text-white/25 text-xs font-mono">{user.id.slice(0, 12)}…</div>
                      </div>
                    </div>

                    {/* Role */}
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${roleConfig.bg} ${roleConfig.border} ${roleConfig.color}`}>
                        <RoleIcon className="w-3.5 h-3.5" />
                        {roleConfig.label}
                      </span>
                    </div>

                    {/* Tier */}
                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${tierConfig.bg} ${tierConfig.color}`}>
                        {(user.subscription_tier === 'elite' || user.subscription_tier === 'plus') && (
                          <Crown className="w-3 h-3" />
                        )}
                        {tierConfig.label}
                      </span>
                    </div>

                    {/* Joined */}
                    <div className="col-span-2 text-white/35 text-sm flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>

                    {/* Actions */}
                    <div className="col-span-3">
                      {isChangingThis ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-500" />
                      ) : isSelf ? (
                        <span className="text-white/25 text-xs">Cannot edit self</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <SelectDropdown
                            value={user.user_role}
                            options={[
                              { value: 'user', label: 'User' },
                              { value: 'manager', label: 'Manager' },
                              { value: 'admin', label: 'Admin' },
                            ]}
                            onChange={v => handleRoleChange(user.id, user.name, user.user_role, v as UserRole)}
                            placeholder="Role"
                          />
                          <SelectDropdown
                            value={user.subscription_tier || 'free'}
                            options={Object.entries(TIER_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))}
                            onChange={v => handleTierChange(user.id, user.name, user.subscription_tier || 'free', v)}
                            placeholder="Tier"
                          />
                          <button
                            onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 border border-white/10 hover:border-white/20 transition"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-white/25 text-xs">
          Showing {filteredSortedUsers.length} of {users.length} users
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border border-white/15 p-6 max-w-md w-full" style={{ background: 'rgba(13,17,40,0.98)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Confirm Change</h3>
            </div>
            <p className="text-white/60 text-sm mb-2">
              Change <span className="text-white font-medium">{confirmDialog.userName || 'this user'}</span>'s{' '}
              {confirmDialog.type === 'role' ? 'role' : 'subscription'} from{' '}
              <span className="text-amber-300 font-medium capitalize">{confirmDialog.current}</span> to{' '}
              <span className="text-sky-300 font-medium capitalize">{confirmDialog.next}</span>?
            </p>
            {confirmDialog.type === 'role' && confirmDialog.next === 'admin' && (
              <p className="mt-2 p-3 rounded-lg text-amber-400/80 text-xs bg-amber-500/10 border border-amber-500/20">
                Admins have full access to all data, user management, and system configuration.
              </p>
            )}
            {confirmDialog.type === 'tier' && (
              <p className="mt-2 p-3 rounded-lg text-sky-400/80 text-xs bg-sky-500/10 border border-sky-500/20">
                This overrides the user's Stripe subscription. Manual tier changes should be synchronized with billing.
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white/60 border border-white/10 hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmChange}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition"
                style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User detail panel */}
      {selectedUser && (
        <div className="fixed inset-y-0 right-0 w-80 border-l border-white/10 p-6 flex flex-col z-40 overflow-y-auto"
          style={{ background: 'rgba(9,12,30,0.98)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold">User Detail</h3>
            <button onClick={() => setSelectedUser(null)} className="text-white/30 hover:text-white/60 text-xl leading-none">×</button>
          </div>

          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-4 mx-auto"
            style={{ background: 'rgba(244,63,107,0.2)' }}>
            {(selectedUser.name || '?')[0].toUpperCase()}
          </div>

          <p className="text-white font-semibold text-center mb-1">{selectedUser.name || 'Unnamed'}</p>
          <p className="text-white/40 text-xs text-center font-mono mb-6">{selectedUser.id}</p>

          <div className="space-y-3 text-sm">
            <DetailRow icon={Shield} label="Role" value={ROLE_CONFIG[selectedUser.user_role]?.label || selectedUser.user_role} />
            <DetailRow icon={Crown} label="Subscription" value={TIER_CONFIG[selectedUser.subscription_tier || 'free']?.label || 'Free'} />
            <DetailRow icon={Calendar} label="Joined" value={new Date(selectedUser.created_at).toLocaleDateString()} />
          </div>
        </div>
      )}
    </div>
  );
}

function SelectDropdown({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none text-xs rounded-lg px-2.5 py-1.5 pr-6 text-white/70 cursor-pointer hover:text-white transition focus:outline-none"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#0d1128' }}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5">
      <div className="flex items-center gap-2 text-white/40">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-white text-xs font-medium">{value}</span>
    </div>
  );
}
