import { supabase } from '../shared/supabase/client';

export type UserRole = 'user' | 'manager' | 'admin';

export interface UserWithRole {
  id: string;
  name: string;
  email: string;
  user_role: UserRole;
  subscription_tier: string | null;
  created_at: string;
}

class RoleService {
  private cachedRole: UserRole | null = null;
  private cachedUserId: string | null = null;

  async getCurrentUserRole(): Promise<UserRole> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'user';

    if (this.cachedUserId === user.id && this.cachedRole) {
      return this.cachedRole;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_role')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) {
      return 'user';
    }

    this.cachedRole = (data.user_role as UserRole) || 'user';
    this.cachedUserId = user.id;
    return this.cachedRole;
  }

  async isAdmin(): Promise<boolean> {
    const role = await this.getCurrentUserRole();
    return role === 'admin';
  }

  async isManagerOrAbove(): Promise<boolean> {
    const role = await this.getCurrentUserRole();
    return role === 'manager' || role === 'admin';
  }

  async getAllUsers(): Promise<UserWithRole[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, name, user_role, subscription_tier, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    const users: UserWithRole[] = (data || []).map(u => ({
      ...u,
      email: '',
      user_role: (u.user_role as UserRole) || 'user',
    }));

    return users;
  }

  async updateUserRole(targetUserId: string, newRole: UserRole): Promise<boolean> {
    const { error } = await supabase
      .from('user_profiles')
      .update({ user_role: newRole })
      .eq('id', targetUserId);

    if (error) {
      console.error('Error updating user role:', error);
      return false;
    }

    if (this.cachedUserId === targetUserId) {
      this.cachedRole = newRole;
    }

    return true;
  }

  clearCache() {
    this.cachedRole = null;
    this.cachedUserId = null;
  }
}

export const roleService = new RoleService();
