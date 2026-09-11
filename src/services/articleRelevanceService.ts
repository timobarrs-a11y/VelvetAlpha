import type { CompanionWithLastMessage } from './companionService';
import { getCorrespondentById } from '../config/signatureCorrespondents';
import { getExpertById } from '../config/signatureExperts';

export interface RelevanceInput {
  categories: string[];
  specific_topics?: string[];
}

export interface CompanionMatch {
  companion: CompanionWithLastMessage;
  reason: string;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function substringMatch(articleTag: string, candidate: string): boolean {
  const a = normalize(articleTag);
  const c = normalize(candidate);
  return a.includes(c) || c.includes(a);
}

function anyOverlap(articleTags: string[], candidates: string[]): string | null {
  for (const tag of articleTags) {
    for (const candidate of candidates) {
      if (substringMatch(tag, candidate)) return tag;
    }
  }
  return null;
}

export function matchCompanionsToArticle(
  article: RelevanceInput,
  companions: CompanionWithLastMessage[],
): CompanionMatch[] {
  const articleTags = [
    ...(article.categories ?? []),
    ...(article.specific_topics ?? []),
  ];
  if (articleTags.length === 0) return [];

  const matches: CompanionMatch[] = [];

  for (const companion of companions) {
    const matchedTag = matchSingleCompanion(companion, articleTags);
    if (matchedTag) {
      matches.push({ companion, reason: matchedTag });
    }
  }

  return matches;
}

function matchSingleCompanion(
  companion: CompanionWithLastMessage,
  articleTags: string[],
): string | null {
  const relationshipType = companion.relationship_type;

  if (relationshipType === 'correspondent') {
    return matchCorrespondent(companion, articleTags);
  }

  if (relationshipType === 'mentor') {
    return matchMentor(companion, articleTags);
  }

  return matchCompanion(companion, articleTags);
}

function matchCorrespondent(
  companion: CompanionWithLastMessage,
  articleTags: string[],
): string | null {
  if (!companion.correspondent_id) return null;
  const config = getCorrespondentById(companion.correspondent_id);
  if (!config) return null;

  const candidates = [...config.newsCategories, ...config.interestKeywords];
  const tag = anyOverlap(articleTags, candidates);
  if (!tag) return null;

  return `tagged ${tag}, matches ${config.name}'s news beat`;
}

function matchMentor(
  companion: CompanionWithLastMessage,
  articleTags: string[],
): string | null {
  if (!companion.signature_expert) return null;
  const config = getExpertById(companion.signature_expert);
  if (!config) return null;

  const tag = anyOverlap(articleTags, [config.domain]);
  if (!tag) return null;

  return `tagged ${tag}, matches ${config.name}'s domain`;
}

function matchCompanion(
  companion: CompanionWithLastMessage,
  articleTags: string[],
): string | null {
  const candidates: string[] = [
    ...(companion.hobbies ?? []),
  ];

  if (companion.interest_text) {
    candidates.push(companion.interest_text);
  }

  if (candidates.length === 0) return null;

  const tag = anyOverlap(articleTags, candidates);
  if (!tag) return null;

  const name = companion.custom_name || 'your companion';
  return `tagged ${tag}, matches ${name}'s interests`;
}
