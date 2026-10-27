// The short branded welcome that opens the questionnaire, shown once per member.

const FLAG = 'velvet.welcome.seen';

function storage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

/** Show it only to someone starting from the very first question who has not seen it. */
export function shouldShowWelcome(profile: { id?: string; welcome_seen?: boolean | null } | null, startIndex: number): boolean {
  if (startIndex !== 0) return false;
  if (profile?.welcome_seen) return false;
  const saved = storage();
  if (saved && profile?.id && saved.getItem(`${FLAG}.${profile.id}`) === '1') return false;
  return true;
}

/** Remember it on this device now; the caller saves welcome_seen on the profile too. */
export function rememberWelcomeSeen(userId: string | undefined): void {
  const saved = storage();
  if (saved && userId) {
    try { saved.setItem(`${FLAG}.${userId}`, '1'); } catch { /* private mode: the profile flag still counts */ }
  }
}
