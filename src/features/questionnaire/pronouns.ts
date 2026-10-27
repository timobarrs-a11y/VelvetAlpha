import type { PronounSet, QuestionContext } from './types';

export const PRONOUNS_FEMALE: PronounSet = {
  she: 'she',
  her: 'her',
  hers: 'hers',
  herself: 'herself',
};

export const PRONOUNS_MALE: PronounSet = {
  she: 'he',
  her: 'him',
  hers: 'his',
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
  return template
    .replace(/\{she\}/g, ctx.pronouns.she)
    .replace(/\{her\}/g, ctx.pronouns.her)
    .replace(/\{hers\}/g, ctx.pronouns.hers)
    .replace(/\{herself\}/g, ctx.pronouns.herself)
    .replace(/\{name\}/g, ctx.userName || '');
}
