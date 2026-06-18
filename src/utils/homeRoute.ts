import { getCompanions } from '../services/companionService';

// Single source of truth for where a user lands when they "enter the app" after
// onboarding completes. Product rule: a user who has a companion should always
// drop straight into that companion's chat — never the lobby. Only users with
// no companion at all fall back to the lobby.
export async function resolveHomeRoute(userId: string): Promise<string> {
  try {
    const companions = await getCompanions(userId);
    if (companions.length > 0) {
      const lastId = localStorage.getItem('velvet_last_companion');
      const target = lastId && companions.some(c => c.id === lastId)
        ? lastId
        : companions[0].id;
      return `/chat?companion=${target}`;
    }
  } catch {
    /* fall through to lobby on any lookup failure */
  }
  return '/lobby';
}
