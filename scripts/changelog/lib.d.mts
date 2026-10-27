export const CATEGORIES: string[];
export function extractWhatsNew(body: string | null | undefined): string | null;
export function cleanTitle(title: string | null | undefined): string;
export function pickCategory(title: string | null | undefined, labels?: Array<string | { name: string }>): string;
export interface ChangelogEntry { title: string; body: string; category: string; tags: string[]; sourceRef: string; publishedAt: string }
export function buildEntry(pr: {
  number: number; title?: string | null; body?: string | null; merged?: boolean; merged_at?: string | null; labels?: Array<string | { name: string }>;
} | null | undefined): ChangelogEntry | null;
