import { describe, it, expect, vi } from 'vitest';

vi.mock('npm:@supabase/supabase-js@2', () => ({ createClient: () => ({}) }));

import { buildAssistantBehavioralInstructions } from '../../../supabase/functions/_shared/assistantFramework';
import { buildPersonaLayer } from '../../../supabase/functions/_shared/personaBuilder';
import { isHelper } from '../../utils/relationshipType';


describe('the assistant framework', () => {
  const block = buildAssistantBehavioralInstructions({
    assistantName: 'Maya', userName: 'Tim', goalText: 'Buy a home', accountabilityLevel: 'firm', checkInStyle: 'proactive',
  });

  it('works one goal and does the legwork, without teaching', () => {
    expect(block).toContain("You are Maya, Tim's assistant for one goal: \"Buy a home\"");
    expect(block).toContain('You are not a coach');
    expect(block).toContain('MAKE IT VISIBLE, WITHOUT BEING ASKED');
    expect(block).toContain('create_plan');
    expect(block).toContain('Record them (create_commitment) only once they agree');
  });

  it('uses the same tone dials as coaches', () => {
    expect(block).toContain('ACCOUNTABILITY — FIRM');
    expect(block).toContain('CHECK-IN STYLE — PROACTIVE');
  });
});

describe('an assistant persona', () => {
  const base = {
    custom_name: 'Maya', gender: 'female', signature_voice: null, voice_baseline: null, drift_needs_correction: null,
    energy_preference: null, humor_style: null, flirting_style: 'bold', love_language: 'words of affirmation', dynamic_preference: null,
  };

  it('is professional, never romantic', () => {
    const persona = buildPersonaLayer({ ...base, relationship_type: 'assistant' } as never, 'Tim');
    expect(persona).toContain('personal assistant helping Tim get one goal done');
    expect(persona).toContain('No romance');
    expect(persona).not.toMatch(/Flirting:|Love language:/);
  });
});

describe('isHelper', () => {
  it('groups coaches and assistants apart from companions', () => {
    expect(['mentor', 'assistant', 'friend', 'romantic', null].map(isHelper)).toEqual([true, true, false, false, false]);
  });
});
