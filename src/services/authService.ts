import { supabase } from '../shared/supabase/client';

// Authentication failures are reported with a fixed message so the response does not
// reveal whether an email address already has an account. Only rate limiting and
// password-strength feedback, which say nothing about account existence, pass through.
function authFailureMessage(raw: string | undefined): string {
  const message = (raw || '').toLowerCase();

  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (message.includes('password') && (message.includes('short') || message.includes('least') || message.includes('weak') || message.includes('characters'))) {
    return 'Please choose a longer, stronger password.';
  }
  if (message.includes('valid email') || message.includes('invalid email') || message.includes('email address is invalid')) {
    return 'Please enter a valid email address.';
  }
  if (message.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }

  return 'We could not complete that request. Please check your details and try again.';
}

export const authService = {
  async signUp(
    email: string,
    password: string,
    consent: {
      termsVersion: string;
      termsAcceptedAt: string;
      birthday: string; // ISO date string YYYY-MM-DD
      botCheckToken?: string; // honeypot field — must be empty
      formRenderedAt: number; // timestamp when form was rendered
    }
  ) {
    // Client-side bot checks (server validates too, but these catch most bots early)
    if (consent.botCheckToken) {
      throw new Error('We could not complete that request. Please try again.');
    }
    // Form submitted in under 2 seconds = likely a bot
    if (Date.now() - consent.formRenderedAt < 2000) {
      throw new Error('Please take a moment to review your information and try again.');
    }

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) throw new Error(authFailureMessage(error.message));
    if (!data.user) throw new Error(authFailureMessage(undefined));

    // Insert a minimal profile row — age/consent fields are set server-side below.
    // This insert may fail silently if email confirmation is on (no session yet);
    // verify_age_and_consent will be called after confirmation instead.
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: data.user.id,
        name: 'there',
      });

    if (profileError && !profileError.message.includes('duplicate')) {
      console.error('Profile insert error:', profileError.message);
    }

    // If we have a session (email confirmation off), verify age server-side now.
    // Otherwise this runs after the user confirms and lands in the app.
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { error: ageError } = await supabase.rpc('verify_age_and_consent', {
        p_birthday: consent.birthday,
        p_terms_version: consent.termsVersion,
        p_terms_accepted_at: consent.termsAcceptedAt,
      });
      if (ageError) {
        console.error('Age verification error:', ageError.message);
      }

      // Start the 48-hour welcome window
      const { error: welcomeError } = await supabase.rpc('start_welcome_window');
      if (welcomeError) {
        console.error('Welcome window error:', welcomeError.message);
      }
    }

    return data.user;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(authFailureMessage(error.message));
    }

    if (!data.user) {
      throw new Error(authFailureMessage(undefined));
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

  /** Sends the browser to Google; they come back signed in at the app's front door. */
  async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/lobby` },
    });
    if (error) throw new Error('We could not reach Google. Please try again.');
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
