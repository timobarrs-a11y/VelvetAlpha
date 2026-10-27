import { describe, it, expect } from 'vitest';
import { buildPersonaLayer } from '../../../supabase/functions/_shared/personaBuilder';

const companion = (relationship_type: string) => ({ custom_name: 'Mei', relationship_type, gender: 'female', signature_voice: null } as Parameters<typeof buildPersonaLayer>[0]);

describe('what a coach or assistant calls you', () => {
  it('is the nickname, never the real name or Master/Miss', () => {
    for (const type of ['mentor', 'assistant']) {
      const text = buildPersonaLayer(companion(type), 'Mase', 'Smashing Pumpkin');
      expect(text).toContain('Always address them by their nickname (Smashing Pumpkin)');
      expect(text).toMatch(/Never use their real name, and never "Master" or "Miss"/);
      // the real name is not in their prompt at all, so it cannot leak into a reply
      expect(text).not.toContain('Mase');
      expect(text.toUpperCase()).not.toContain('MASE');
      expect(text).toContain('Smashing Pumpkin');
    }
  });

  it('falls back to the name they gave only when there is no nickname (older accounts)', () => {
    const text = buildPersonaLayer(companion('mentor'), 'Mase', null);
    expect(text).toContain('Mase');
    expect(text).not.toContain('NAME PREFERENCE');
  });

  it('leaves companions as they were: the nickname first, the real name only for serious moments', () => {
    const text = buildPersonaLayer(companion('friend'), 'Mase', 'Smashing Pumpkin');
    expect(text).toContain('Use their nickname (Smashing Pumpkin) as your default');
    expect(text).toContain('only in serious or formal moments');
  });
});
