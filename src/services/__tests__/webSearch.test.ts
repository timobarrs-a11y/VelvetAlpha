import { describe, it, expect } from 'vitest';
import { webSearchTool, textOf, continuePausedTurn } from '../../../supabase/functions/_shared/webSearch';

describe('web search helpers', () => {
  it('describes the server tool with a search budget', () => {
    expect(webSearchTool(2)).toEqual({ type: 'web_search_20250305', name: 'web_search', max_uses: 2 });
  });

  it('keeps only the text of a reply that searched', () => {
    const content = [
      { type: 'text', text: 'Let me check. ' },
      { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'Chicago marathon 2027 date' } },
      { type: 'web_search_tool_result', tool_use_id: 's1', content: [] },
      { type: 'text', text: 'The race is on ' },
      { type: 'text', text: 'October 10.', citations: [{ url: 'https://example.com' }] },
    ];
    expect(textOf(content)).toBe('Let me check. The race is on October 10.');
    expect(textOf(null)).toBe('');
  });

  it('hands a paused turn back as the assistant', () => {
    const next = continuePausedTurn([{ role: 'user', content: 'plan it' }], [{ type: 'text', text: 'Searching' }]);
    expect(next[1]).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'Searching' }] });
  });
});
