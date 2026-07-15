// Shared content-moderation for the AI chat surfaces (chat, chat-turn, group-chat).
//
// SCOPE: This is an adult companion product, so ordinary adult/romantic content
// is allowed by design. This filter targets the one category that is illegal and
// non-negotiable: sexual content involving minors (CSAE). It runs BEFORE the user
// message is stored or sent to the model, so disallowed input never lands in the
// database and never reaches the API.
//
// STRATEGY: two tiers, both local (zero added latency, zero cost):
//   1. Zero-tolerance phrases — unambiguous, blocked on their own.
//   2. Co-occurrence — a minor indicator AND a sexual indicator in the same
//      message. Requiring both keeps false positives low (adult sexting has no
//      minor tokens; "picking up my kid from school" has no sexual tokens).
//
// This is intentionally a first line of defense, not a complete T&S program.
// It pairs with the model's own refusals, per-user strikes/bans, and an audit log.

export type ModerationCategory = 'csae';

export interface ModerationResult {
  action: 'allow' | 'block';
  category: ModerationCategory | null;
}

// Produce normalized views of the text to defeat common evasion. We return TWO
// forms because they serve different detectors:
//   - `digits`: digits preserved — needed for age detection ("14 yo", "13yo").
//   - `deleet`: leetspeak folded to letters ("l0li"->"loli", "ch1ld"->"child")
//     — needed for the word lists. (This one destroys digits, so ages use `digits`.)
// Each form also appends a separator-stripped copy so spaced-out evasion
// ("l o l i" -> "loli", "1 4 y o" -> "14yo") still matches at a word boundary.
function normalizeForms(input: string): { digits: string; deleet: string } {
  const lowered = input.toLowerCase();
  const collapse = (s: string) => {
    const spaced = s.replace(/[^a-z0-9]+/g, ' ').trim();
    return spaced + ' ' + spaced.replace(/\s+/g, '');
  };
  const deleet = lowered
    .replace(/[@4]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't');
  return { digits: collapse(lowered), deleet: collapse(deleet) };
}

// 1. Unambiguous — block on their own.
const ZERO_TOLERANCE: RegExp[] = [
  /child\s*p[o]rn/,
  /\bcsam\b/,
  /\bcsae\b/,
  /\bloli(con)?\b/,
  /\bshota(con)?\b/,
  /\bjailbait\b/,
  /\bpedo(phil(e|ia))?\b/,
  /(under\s*age|underage)\s*(sex|porn|nud|naked|xxx)/,
  /child\s*(sex|porn|nud|naked|molest)/,
  /(minor|kid|child)\s*(sexual|fuck|blowjob|nude|naked)/,
  /(sex|fuck|rape|molest)\w*\s*(a\s*)?(child|minor|kid|toddler|infant)/,
];

// 2a. Minor indicators (not blocked alone).
const MINOR_INDICATORS: RegExp[] = [
  /\b(child|children|kid|kids|minor|minors|underage|under\s*age)\b/,
  /\b(toddler|infant|baby|preteen|pre\s*teen|tween)\b/,
  /\b(little\s*(girl|boy)|schoolgirl|schoolboy)\b/,
  /\b(elementary|middle\s*school|grade\s*school|kindergarten)\b/,
  // Ages 1-17 stated as an age: "13 yo", "15 years old", "7yr old".
  /\b([1-9]|1[0-7])\s*(yo|y\/o|yr?s?\s*old|year[\s-]*old|years?\s*old)\b/,
];

// 2b. Sexual indicators (not blocked alone — allowed for adults).
const SEXUAL_INDICATORS: RegExp[] = [
  /\b(sex|sexual|sexy|nude|naked|nud|porn|xxx|horny|aroused)\b/,
  /\b(fuck|fucking|blowjob|handjob|cum|orgasm|masturbat|penetrat)\b/,
  /\b(penis|vagina|pussy|dick|cock|boobs|breasts|genital|nipple)\b/,
  /\b(molest|rape|fondle|grope|undress|strip)\b/,
];

// Match patterns against any of the provided normalized forms.
function anyMatch(patterns: RegExp[], forms: string[]): boolean {
  return patterns.some((re) => forms.some((f) => re.test(f)));
}

/**
 * Screen a single piece of user (or model) text. Returns block only for the
 * illegal CSAE category; everything else — including adult content — is allowed.
 */
export function screenText(raw: string): ModerationResult {
  if (!raw || typeof raw !== 'string') return { action: 'allow', category: null };
  const { digits, deleet } = normalizeForms(raw);

  // Word-based patterns run against both forms; age patterns need digits intact.
  if (anyMatch(ZERO_TOLERANCE, [digits, deleet])) {
    return { action: 'block', category: 'csae' };
  }
  const hasMinor = anyMatch(MINOR_INDICATORS, [digits, deleet]);
  const hasSexual = anyMatch(SEXUAL_INDICATORS, [digits, deleet]);
  if (hasMinor && hasSexual) {
    return { action: 'block', category: 'csae' };
  }
  return { action: 'allow', category: null };
}

/**
 * Record a blocked event and apply a strike/ban via the service-role RPC.
 * We deliberately do NOT persist the offending text — only who/when/category.
 * Returns the user's new strike count (or null on failure). Never throws.
 */
export async function recordModerationStrike(
  supabaseAdmin: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  userId: string,
  category: ModerationCategory,
): Promise<number | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('record_moderation_strike', {
      p_user_id: userId,
      p_category: category,
    });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  } catch {
    return null;
  }
}

// A safe, non-graphic refusal returned to the client on a block.
export const MODERATION_REFUSAL =
  "This request was blocked for violating our content policy. Sexual content involving minors is strictly prohibited and this attempt has been logged. Repeated violations will result in a permanent ban.";
