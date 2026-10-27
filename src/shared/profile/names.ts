// What to call someone. A nickname comes first everywhere; a real name is optional and private.

const PLACEHOLDER_NAMES = new Set(['babe', 'there', 'member']);

interface NameFields {
  nickname?: string | null;
  name?: string | null;
}

function clean(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** The real name they gave, or '' when they gave none (or it is a placeholder). */
export function realNameOf(profile: NameFields | null | undefined): string {
  const name = clean(profile?.name);
  return name && !PLACEHOLDER_NAMES.has(name.toLowerCase()) ? name : '';
}

/**
 * Who we are talking to, in private (greetings, Atlas, coaches): the nickname, or their real
 * first name if that is all they gave, or undefined.
 */
export function callName(profile: NameFields | null | undefined): string | undefined {
  const nick = clean(profile?.nickname);
  if (nick) return nick;
  const real = realNameOf(profile);
  return real ? real.split(' ')[0] : undefined;
}

/** What other people see: the nickname only. A real name is never shown unless they put it there themselves. */
export function publicName(profile: NameFields | null | undefined): string | undefined {
  return clean(profile?.nickname) || undefined;
}
