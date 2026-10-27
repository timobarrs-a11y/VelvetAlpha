import { describe, it, expect } from 'vitest';
import { extractWhatsNew, cleanTitle, pickCategory, buildEntry } from '../lib.mjs';

describe('extractWhatsNew', () => {
  it('takes the section up to the next heading', () => {
    const body = '## Summary\ninternal\n\n## What\'s new\nYou can now send mail.\n\n## Testing\nran tests';
    expect(extractWhatsNew(body)).toBe('You can now send mail.');
  });
  it('is null when missing, empty, a placeholder, or only a comment', () => {
    expect(extractWhatsNew('## Summary\nx')).toBeNull();
    expect(extractWhatsNew('## What\'s new\n\n## Testing')).toBeNull();
    expect(extractWhatsNew('## What\'s new\nn/a')).toBeNull();
    expect(extractWhatsNew('## What\'s new\n<!-- write here -->\n## Testing')).toBeNull();
    expect(extractWhatsNew(null)).toBeNull();
  });
});

describe('cleanTitle', () => {
  it('drops the conventional prefix and PR number', () => {
    expect(cleanTitle('feat(town): add mail (#12)')).toBe('Add mail');
    expect(cleanTitle('Plain title')).toBe('Plain title');
  });
});

describe('pickCategory', () => {
  it('prefers labels, then the prefix, then feature', () => {
    expect(pickCategory('feat: x', [{ name: 'design' }])).toBe('design');
    expect(pickCategory('fix: x')).toBe('fix');
    expect(pickCategory('something')).toBe('feature');
  });
});

describe('buildEntry', () => {
  const pr = { number: 7, title: 'feat: Spaces', body: '## What\'s new\nSpaces is here.', merged_at: '2026-10-27T00:00:00Z', labels: [] };
  it('builds an entry for a merged PR with a section', () => {
    expect(buildEntry(pr)).toMatchObject({ title: 'Spaces', body: 'Spaces is here.', sourceRef: 'pr-7', category: 'feature' });
  });
  it('skips unmerged, no-changelog, and sectionless PRs', () => {
    expect(buildEntry({ ...pr, merged_at: null })).toBeNull();
    expect(buildEntry({ ...pr, labels: [{ name: 'no-changelog' }] })).toBeNull();
    expect(buildEntry({ ...pr, body: 'nothing' })).toBeNull();
  });
  it('publishes a sectionless PR when labelled changelog', () => {
    expect(buildEntry({ ...pr, body: '', labels: ['changelog'] })?.body).toBe('Spaces');
  });
});
