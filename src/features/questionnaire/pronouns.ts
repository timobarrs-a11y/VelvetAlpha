import type { PronounSet, QuestionContext } from './types';

export const PRONOUNS_FEMALE: PronounSet = {
  she: 'she',
  her: 'her',
  hers: 'hers',
  their: 'her',
  herself: 'herself',
};

export const PRONOUNS_MALE: PronounSet = {
  she: 'he',
  her: 'him',
  hers: 'his',
  their: 'his',
  herself: 'himself',
};

export function getPronouns(gender: string): PronounSet {
  return gender === 'Male' ? PRONOUNS_MALE : PRONOUNS_FEMALE;
}

export function makeContext(
  answers: Record<string, string | string[]>,
  gender: string,
  subject: 'companion' | 'friend' | 'user',
  userName?: string
): QuestionContext {
  return {
    answers,
    pronouns: getPronouns(gender),
    subject,
    userName,
  };
}

export function tpl(template: string, ctx: QuestionContext): string {
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  return template
    // Capitalised at the start of a sentence: {She}'s ready.
    .replace(/\{She\}/g, cap(ctx.pronouns.she))
    .replace(/\{Her\}/g, cap(ctx.pronouns.her))
    .replace(/\{she\}/g, ctx.pronouns.she)
    .replace(/\{her\}/g, ctx.pronouns.her)
    .replace(/\{hers\}/g, ctx.pronouns.hers)
    .replace(/\{their\}/g, ctx.pronouns.their)
    .replace(/\{herself\}/g, ctx.pronouns.herself)
    .replace(/\{name\}/g, ctx.userName || '');
}
