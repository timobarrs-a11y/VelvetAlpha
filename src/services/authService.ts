import { supabase } from '../shared/supabase/client';

export const authService = {
  async signUp(
    email: string,
    password: string,
    consent: { termsVersion: string; termsAcceptedAt: string; ageVerifiedAt: string; birthday?: string }
  ) {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Failed to create account');

    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: data.user.id,
        name: 'there',
        terms_accepted_at: consent.termsAcceptedAt,
        terms_version: consent.termsVersion,
        age_verified_at: consent.ageVerifiedAt,
        birthday: consent.birthday ?? null,
      });

    if (profileError && !profileError.message.includes('duplicate')) {
      // Non-duplicate errors are logged but not fatal — auth account was created
      console.error('Profile insert error:', profileError.message);
    }

    return data.user;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Failed to sign in');
    }

    // Ensure user_profiles row exists (handles legacy users)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!profile) {
      // Create profile if it doesn't exist
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: data.user.id,
          name: 'there',
        });

      if (profileError) {
        // Don't throw - user can still proceed
      }
    }

    const { data: companions } = await supabase
      .from('companions')
      .select('id, name, gender, avatar_config')
      .eq('user_id', data.user.id)
      .order('created_at', { ascending: true });

    return {
      user: data.user,
      companions: companions ?? [],
    };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      throw new Error(error.message);
    }

    return user;
  },

  async getCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message);
    }

    return session;
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  },
};
