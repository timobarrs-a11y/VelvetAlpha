import { matchCompanionsToArticle, type RelevanceInput } from './articleRelevanceService';
import type { CompanionWithLastMessage } from './companionService';
import { selectOpenerTone, pickOpener } from '../config/articleOpenerTemplates';

export const EXCLUDED_BADGE_CATEGORIES = ['Politics', 'World News'];

export interface ArticleOpenerMatch {
  companion: CompanionWithLastMessage;
  openerText: string;
  reason: string;
}

export function isBadgeExcluded(categories: string[]): boolean {
  const excluded = EXCLUDED_BADGE_CATEGORIES.map(c => c.toLowerCase());
  return categories.some(cat => excluded.includes(cat.toLowerCase()));
}

export function getArticleOpeners(
  article: RelevanceInput,
  companions: CompanionWithLastMessage[],
): ArticleOpenerMatch[] {
  if (isBadgeExcluded(article.categories ?? [])) return [];

  const matches = matchCompanionsToArticle(article, companions);
  if (matches.length === 0) return [];

  const topic = (article.categories ?? [])[0] ?? 'this';

  return matches.map(({ companion, reason }) => {
    const tone = selectOpenerTone(companion.humor_style);
    const openerText = pickOpener(tone, topic);
    return { companion, openerText, reason };
  });
}
