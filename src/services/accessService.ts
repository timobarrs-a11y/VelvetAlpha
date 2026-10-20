import { supabase } from '../shared/supabase/client';

export interface AccessState {
  tier: string;
  age_verified: boolean;
  welcome_window_active: boolean;
  welcome_window_expires_at: string | null;
  trial_active: boolean;
  trial_expires_at: string | null;
  is_paid: boolean;
  is_bot: boolean;
  can_access_social: boolean;
}

export async function checkAccess(): Promise<AccessState | null> {
  try {
    const { data, error } = await supabase.rpc('check_access');
    if (error) {
      console.error('[accessService] check_access error:', error.message);
      return null;
    }
    return data as AccessState;
  } catch {
    return null;
  }
}

const PENDING_DOB_KEY = 'velvet_pending_dob';
const PENDING_TERMS_KEY = 'velvet_pending_terms';

/**
 * Store DOB + terms version in sessionStorage before signup so that
 * after email confirmation redirect, we can complete server-side age verification.
 */
export function storePendingAgeVerification(birthday: string, termsVersion: string) {
  sessionStorage.setItem(PENDING_DOB_KEY, birthday);
  sessionStorage.setItem(PENDING_TERMS_KEY, termsVersion);
}

/**
 * After email confirmation, if the user hasn't been age-verified yet,
 * complete the verification using the DOB stored before signup.
 * Also starts the welcome window if not already started.
 */
export async function completePostConfirmationVerification(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if already verified
    const { data: access } = await supabase.rpc('check_access');
    if (access?.age_verified) {
      // Already verified — just ensure welcome window is started
      if (!access.welcome_window_expires_at) {
        await supabase.rpc('start_welcome_window');
      }
      return;
    }

    // Not verified — try to complete from stored DOB
    const birthday = sessionStorage.getItem(PENDING_DOB_KEY);
    const termsVersion = sessionStorage.getItem(PENDING_TERMS_KEY);

    if (birthday && termsVersion) {
      const { error: ageError } = await supabase.rpc('verify_age_and_consent', {
        p_birthday: birthday,
        p_terms_version: termsVersion,
        p_terms_accepted_at: new Date().toISOString(),
      });

      if (ageError) {
        console.error('[accessService] post-confirmation age verify error:', ageError.message);
      } else {
        sessionStorage.removeItem(PENDING_DOB_KEY);
        sessionStorage.removeItem(PENDING_TERMS_KEY);
      }
    }

    // Start welcome window regardless
    const { error: welcomeError } = await supabase.rpc('start_welcome_window');
    if (welcomeError) {
      console.error('[accessService] welcome window error:', welcomeError.message);
    }
  } catch (e) {
    console.error('[accessService] completePostConfirmationVerification failed:', e);
  }
}
