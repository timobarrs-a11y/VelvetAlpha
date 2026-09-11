// ============================================================================
// Resolves a coach companion's behavioral dials (domain, accountability
// level, check-in style) from its signature_expert reference.
//
// Mirrors the resolution logic in chat-turn/index.ts (curated vs. user
// expert), so background jobs (cron functions with no chat context) see the
// exact same dials the live system prompt uses for that coach.
// ============================================================================

import { getCuratedExpert, AccountabilityLevel, CheckInStyle } from "./coachFramework.ts";

export interface CoachDials {
  domain: string | null;
  accountabilityLevel: AccountabilityLevel;
  checkInStyle: CheckInStyle;
}

const DEFAULT_DIALS: CoachDials = {
  domain: null,
  accountabilityLevel: 'moderate',
  checkInStyle: 'responsive',
};

export async function resolveCoachDials(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  userId: string,
  companion: { signature_expert?: string | null; signature_expert_source?: string | null },
): Promise<CoachDials> {
  if (!companion.signature_expert) return DEFAULT_DIALS;

  if (companion.signature_expert_source === 'user') {
    const { data } = await supabaseAdmin
      .from('user_experts')
      .select('domain, check_in_style, accountability_level')
      .eq('id', companion.signature_expert)
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) return DEFAULT_DIALS;
    return {
      domain: (data.domain as string) || null,
      accountabilityLevel: (data.accountability_level as AccountabilityLevel) || 'moderate',
      checkInStyle: (data.check_in_style as CheckInStyle) || 'responsive',
    };
  }

  const curated = getCuratedExpert(companion.signature_expert);
  if (!curated) return DEFAULT_DIALS;
  return {
    domain: curated.domain,
    accountabilityLevel: curated.accountabilityLevel,
    checkInStyle: curated.checkInStyle,
  };
}
