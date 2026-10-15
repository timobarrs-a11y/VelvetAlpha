export type ChangelogCategory = 'feature' | 'improvement' | 'fix' | 'design' | 'game' | 'infra';

export interface ChangelogEntry {
  id: string;
  title: string;
  body: string;
  version: string | null;
  category: ChangelogCategory;
  tags: string[];
  is_pinned: boolean;
  published_at: string;
  created_at: string;
}

export interface ChangelogEntryWithRead extends ChangelogEntry {
  is_read: boolean;
}

export const CATEGORY_META: Record<ChangelogCategory, { label: string; color: string; icon: string }> = {
  feature: { label: 'New Feature', color: '#10b981', icon: 'sparkles' },
  improvement: { label: 'Improvement', color: '#3b82f6', icon: 'arrow-up' },
  fix: { label: 'Bug Fix', color: '#f43f5e', icon: 'wrench' },
  design: { label: 'Design', color: '#f59e0b', icon: 'palette' },
  game: { label: 'Game Update', color: '#8b5cf6', icon: 'gamepad-2' },
  infra: { label: 'Infrastructure', color: '#64748b', icon: 'server' },
};
