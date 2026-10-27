import type { Gender } from '../../types/avatar-v2';

/** How to refer to a ready-made helper, from the gender their face and name were made with. */
export function helperPronouns(gender: Gender): { subject: string; object: string; possessive: string } {
  return gender === 'male'
    ? { subject: 'he', object: 'him', possessive: 'his' }
    : { subject: 'she', object: 'her', possessive: 'her' };
}
