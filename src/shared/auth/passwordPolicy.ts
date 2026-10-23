// One password rule for every screen that sets a password (sign-up, reset, settings).
// Keep MIN_PASSWORD_LENGTH in step with Supabase: Authentication → password settings
// (minimum length 10, letters and digits required).

export const MIN_PASSWORD_LENGTH = 10;
export const PASSWORD_RULE = `At least ${MIN_PASSWORD_LENGTH} characters, with letters and numbers`;

/** Why this password isn't allowed, or null when it meets the rule. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must include both letters and numbers.';
  return null;
}

export const BREACHED_PASSWORD_MESSAGE = 'This password has appeared in a data breach, so it isn\'t safe to use. Please choose a different one.';

/**
 * Has this password appeared in a known data breach (Have I Been Pwned)? Only the first 5
 * characters of its SHA-1 hash leave the browser, never the password. Returns false if the
 * check can't be done (offline, service down), so it never blocks someone by mistake.
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  try {
    const bytes = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { headers: { 'Add-Padding': 'true' } });
    if (!res.ok) return false;
    const suffix = hash.slice(5);
    return (await res.text()).split('\n').some((line) => {
      const [s, count] = line.trim().split(':');
      return s === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

/** Supabase's own reason, in plain words, when it refuses a password. */
export function passwordErrorMessage(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string } | null;
  if (e?.code === 'weak_password') return `That password is too weak. ${PASSWORD_RULE}.`;
  if (e?.code === 'same_password') return 'That\'s your current password. Please choose a new one.';
  return e?.message || fallback;
}
