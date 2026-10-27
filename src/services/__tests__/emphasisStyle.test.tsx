import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { buildPersonaLayer } from '../../../supabase/functions/_shared/personaBuilder';
import { EMPHASIS_STYLE } from '../../../supabase/functions/_shared/emphasisStyle';
import { AtlasMarkdown } from '../../components/AtlasMarkdown';

const companion = (relationship_type: string) => ({ custom_name: 'Mei', relationship_type, gender: 'female', signature_voice: null } as Parameters<typeof buildPersonaLayer>[0]);

describe('who is told to use bold and italics', () => {
  it('coaches and assistants are', () => {
    for (const type of ['mentor', 'assistant']) expect(buildPersonaLayer(companion(type), 'Mase', 'Pumpkin')).toContain('EMPHASIS (bold and italics');
  });

  it('companions are not: they text like people', () => {
    for (const type of ['friend', 'romantic']) {
      const text = buildPersonaLayer(companion(type), 'Mase', 'Pumpkin');
      expect(text).not.toContain('EMPHASIS (bold and italics');
      expect(text).toContain('TEXTING RHYTHM');
    }
  });

  it('the rules say one key clause per paragraph, titles in italics, and never in code', () => {
    expect(EMPHASIS_STYLE).toMatch(/one bold phrase per paragraph/);
    expect(EMPHASIS_STYLE).toMatch(/Italicize the titles of books, films, games/);
    expect(EMPHASIS_STYLE).toMatch(/never use either inside a code block/);
  });
});

describe('how bold and italics show', () => {
  it('turns **bold** and *italic* into formatting, and cannot be used to inject markup', () => {
    const { container } = render(<AtlasMarkdown content={'Make it **investigate first**, like *Max Payne* plays. <script>alert(1)</script>'} />);
    expect(container.querySelector('strong')?.textContent).toBe('investigate first');
    expect(container.querySelector('em')?.textContent).toBe('Max Payne');
    expect(container.querySelector('script')).toBeNull();
  });

  it('keeps asterisks inside code as they are', () => {
    const { container } = render(<AtlasMarkdown content={'```\na * b * c\n```'} />);
    expect(container.querySelector('em')).toBeNull();
    expect(container.textContent).toContain('a * b * c');
  });
});
