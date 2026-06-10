import { useState, useEffect } from 'react';
import { roleService, UserRole } from '../services/roleService';
import { supabase } from '../shared/supabase/client';

export function useRole() {
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchRole() {
      const userRole = await roleService.getCurrentUserRole();
      if (mounted) {
        setRole(userRole);
        setLoading(false);
      }
    }

    fetchRole();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      (async () => {
        roleService.clearCache();
        const userRole = await roleService.getCurrentUserRole();
        if (mounted) {
          setRole(userRole);
        }
      })();
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    isManagerOrAbove: role === 'manager' || role === 'admin',
  };
}
