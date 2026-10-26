import { describe, it, expect } from 'vitest';
import {
  addressName, buildGoalPrompt, buildOpening, checkReply, firstName, formalAddress, openingPath,
  parseReply, pickRemark, summarizePlan, timeOfDayGreeting, unknownTraits, validTraits, validatePlan,
  OPENING_CHIPS, type ArrivalProfile,
} from '../../../supabase/functions/_shared/atlasArrival';

function profile(overrides: Partial<ArrivalProfile> = {}): ArrivalProfile {
  return {
    name: 'Tim', nickname: null, gender: 'male', favorite_color: 'teal', address_style: null,
    hobbies: 'reading,hiking', sports: 'basketball', music_genre: 'jazz',
    entertainment_interests: ['true crime'], tech_interests: [], lifestyle_interests: ['cooking'],
    sports_interests: ['formula one'], someday: [], arrival_choices: {}, communication_profile: null,
    ...overrides,
  };
}

const TODAY = '2026-10-26';

describe('how Atlas addresses people', () => {
  it('says Master or Miss with the first name, as Alfred does', () => {
    expect(formalAddress(profile())).toBe('Master Tim');
    expect(formalAddress(profile({ name: 'Ana Lopez', gender: 'female' }))).toBe('Miss Ana');
  });

  it('uses first names for anyone else, and for anyone who asked', () => {
    expect(formalAddress(profile({ gender: 'non-binary' }))).toBeNull();
    expect(addressName(profile({ gender: 'non-binary' }))).toBe('Tim');
    expect(addressName(profile({ address_style: 'first_name' }))).toBe('Tim');
  });

  it('never uses a placeholder name', () => {
    expect(firstName(profile({ name: 'babe' }))).toBeNull();
    expect(addressName(profile({ name: null }))).toBeNull();
  });

  it('greets for the hour where they are', () => {
    expect([6, 11, 12, 16, 17, 23, 2].map(timeOfDayGreeting))
      .toEqual(['Good morning', 'Good morning', 'Good afternoon', 'Good afternoon', 'Good evening', 'Good evening', 'Good evening']);
    expect(timeOfDayGreeting(undefined)).toBe('Good day');
  });
});

describe('the remark on what they made', () => {
  it('picks the most distinctive thing they chose by hand', () => {
    expect(pickRemark({ avatar: [{ field: 'hairStyle', value: 'bob' }, { field: 'glasses', value: 'round' }] }))
      .toBe('Splendid spectacles, if I may.');
  });

  it('falls back to the house they chose', () => {
    expect(pickRemark({ avatar: [], house: { style: 'cabin', chosen: true } })).toBe('An A-frame cabin. A person of taste.');
  });

  it('keeps it general when everything was randomized', () => {
    expect(pickRemark({ avatar: [], house: { style: 'cottage', chosen: false } })).toBe("You've settled in nicely, I see.");
  });

  it('makes no remark when they skipped that part', () => {
    expect(pickRemark({})).toBeNull();
    expect(pickRemark(null)).toBeNull();
  });
});

describe('the opening', () => {
  it('greets, remarks, introduces Atlas and Velvet, then asks where things stand', () => {
    const { text, chips } = buildOpening(profile({ arrival_choices: { avatar: [{ field: 'glasses', value: 'round' }] } }), 19);
    expect(text.startsWith('Good evening, Master Tim. Splendid spectacles, if I may.')).toBe(true);
    expect(text).toContain("I'm Atlas.");
    expect(text).toContain('Velvet exists to help people dream large');
    expect(text.trim().endsWith('Where do things stand?')).toBe(true);
    expect(chips).toEqual(OPENING_CHIPS.map(c => c.label));
  });

  it('passes its own reply check, reading back none of their answers', () => {
    const p = profile();
    expect(checkReply(buildOpening(p, 9).text, { profile: p })).toEqual([]);
  });

  it('works out the path from the first answer', () => {
    expect(OPENING_CHIPS.map(c => openingPath(c.label))).toEqual(['working', 'idea', 'none']);
    expect(openingPath('I want to buy a house next year')).toBe('working');
    expect(openingPath("Honestly I'm not sure")).toBe('none');
  });
});

describe('traits', () => {
  it('lists only the traits still unknown', () => {
    expect(unknownTraits({ motivation: 'internal', conflict: 'empathy' })).toEqual(['decisionStyle', 'connection']);
    expect(unknownTraits(null)).toHaveLength(4);
  });

  it('keeps only allowed values, accepting conflictResponse for conflict', () => {
    expect(validTraits({ decisionStyle: 'intuitive', motivation: 'sometimes', conflictResponse: 'empathy', mood: 'happy' }))
      .toEqual({ decisionStyle: 'intuitive', conflict: 'empathy' });
  });
});

describe('parseReply', () => {
  it('pulls out every marker and leaves only what the person should see', () => {
    const raw = `A book. Splendid. Are you one to map every chapter first?
[PROFILE {"motivation":"external"}]
[CHIPS "Map it all first" | "Discover as I go"]
[ADDRESS first_name]`;
    const r = parseReply(raw, TODAY);
    expect(r.text).toBe('A book. Splendid. Are you one to map every chapter first?');
    expect(r.traits).toEqual({ motivation: 'external' });
    expect(r.chips).toEqual(['Map it all first', 'Discover as I go']);
    expect(r.address).toBe('first_name');
    expect(r.goalComplete).toBe(false);
  });

  it('takes a pencilled-in plan only with a real date that is not in the past', () => {
    const ok = parseReply('Done. [PLAN {"title":"Buy tickets","date":"2026-10-31","type":"task","goal":"See a game live"}]', TODAY);
    expect(ok.plans).toEqual([{ title: 'Buy tickets', date: '2026-10-31', time: null, type: 'task', goal: 'See a game live' }]);
    expect(parseReply('[PLAN {"title":"Old","date":"2026-10-01"}]', TODAY).plans).toEqual([]);
    expect(parseReply('[PLAN {"title":"Bad","date":"Saturday"}]', TODAY).plans).toEqual([]);
    expect(parseReply('[PLAN not json]', TODAY).plans).toEqual([]);
  });

  it('spots the end of the conversation and hides the marker', () => {
    const r = parseReply('I know just the person.\n[GOAL_COMPLETE]', TODAY);
    expect(r).toMatchObject({ text: 'I know just the person.', goalComplete: true });
  });

  it('never shows a stray marker, and ignores a single chip', () => {
    const r = parseReply('Right then. [PROFILE broken] [CHIPS "only one"]', TODAY);
    expect(r.text).toBe('Right then.');
    expect(r.chips).toEqual([]);
  });
});

describe('checkReply', () => {
  const p = profile();

  it('passes a reply in voice', () => {
    expect(checkReply('Twenty pounds. A worthy campaign. Does it go better when someone is expecting a report?', { profile: p })).toEqual([]);
  });

  it('flags two questions, banned phrases, exclamation marks, emoji and lists', () => {
    expect(checkReply('Great question! What now? And then?', { profile: p })).toEqual(
      expect.arrayContaining(['asks 2 questions', 'banned phrase: "great question"', 'exclamation mark']),
    );
    expect(checkReply('Lovely 🎉', {})).toContain('emoji');
    expect(checkReply('Options:\n- one\n- two', {})).toContain('list');
  });

  it('flags their answers read back as a list', () => {
    expect(checkReply('Basketball, jazz and hiking. Splendid.', { profile: p })[0]).toMatch(/reads back their answers/);
  });

  it('flags the wrong form of address', () => {
    expect(checkReply('Very good, Master Tim.', { profile: profile({ address_style: 'first_name' }) }))
      .toContain('wrong form of address: "Master Tim"');
    expect(checkReply('Very good, Miss Tim.', { profile: p })).toContain('wrong form of address: "Miss Tim"');
  });
});

describe('the plan', () => {
  const raw = {
    goal: { title: 'Buy a home', targetDate: '2027-09-30', measure: { what: 'down payment saved', unit: '$', target: 30000 } },
    phases: [
      { title: 'Get the money ready', steps: [
        { title: 'Check your credit score', scheduledFor: '2026-10-29', durationMinutes: 30 },
        { title: 'Ancient step', scheduledFor: '2020-01-01', durationMinutes: 2 },
        { title: '', scheduledFor: '2026-11-01' },
      ] },
      { title: 'Empty', steps: [] },
    ],
    commitments: [
      { description: 'Check your credit score', dueDate: '2026-10-29' },
      { description: 'Too far out', dueDate: '2027-01-01' },
    ],
    weeklyRhythm: [{ day: 'monday', what: 'Move $150 to the down payment fund' }, { day: 'Someday', what: 'x' }],
    checkIns: 'Every Monday',
  };

  it('keeps what is usable and drops the rest', () => {
    const plan = validatePlan(raw, TODAY)!;
    expect(plan.phases).toEqual([{ title: 'Get the money ready', steps: [
      { title: 'Check your credit score', scheduledFor: '2026-10-29', durationMinutes: 30 },
      { title: 'Ancient step', scheduledFor: null, durationMinutes: null },
    ] }]);
    expect(plan.commitments).toEqual([{ description: 'Check your credit score', dueDate: '2026-10-29' }]);
    expect(plan.weeklyRhythm).toEqual([{ day: 'Monday', what: 'Move $150 to the down payment fund' }]);
    expect(plan.goal.measure).toEqual({ what: 'down payment saved', unit: '$', target: 30000 });
  });

  it('returns nothing when there is no step to take', () => {
    expect(validatePlan({ phases: [] }, TODAY)).toBeNull();
    expect(validatePlan('nonsense', TODAY)).toBeNull();
  });

  it('works out the finish date and how long it runs', () => {
    expect(summarizePlan(validatePlan(raw, TODAY)!, TODAY)).toEqual({ finishDate: '2027-09-30', runTime: '11 months' });
    const short = validatePlan({ ...raw, goal: { title: 'Portfolio', targetDate: '2026-11-20' } }, TODAY)!;
    expect(summarizePlan(short, TODAY).runTime).toBe('4 weeks');
  });
});

describe('buildGoalPrompt', () => {
  it('offers the formal address once only while they have not chosen', () => {
    expect(buildGoalPrompt(profile(), 'working', { date: TODAY, weekday: 'Monday' }, 10)).toContain('I\'ll keep the formalities');
    expect(buildGoalPrompt(profile({ address_style: 'formal' }), 'working', { date: TODAY, weekday: 'Monday' }, 10)).not.toContain('I\'ll keep the formalities');
    expect(buildGoalPrompt(profile({ address_style: 'first_name' }), 'working', { date: TODAY, weekday: 'Monday' }, 10)).toContain('Never "Master" or "Miss"');
  });

  it('lists only unknown traits and the backup material in order', () => {
    const prompt = buildGoalPrompt(
      profile({ communication_profile: { motivation: 'internal' }, someday: [{ tab: 'Work', value: 'Tech & IT' }] }),
      'none', { date: TODAY, weekday: 'Monday' }, 10,
    );
    expect(prompt).toContain("THEY DON'T HAVE A GOAL YET");
    expect(prompt).toContain('Tech & IT');
    expect(prompt).toContain('sports they follow: formula one');
    expect(prompt).not.toMatch(/- motivation:/);
    expect(prompt).toMatch(/- decisionStyle:/);
    expect(prompt).toContain('TODAY: Monday, 2026-10-26');
  });
});

describe('dates in the user\'s time zone', () => {
  it('works out today and its weekday from the page', async () => {
    const { todayFrom } = await import('../../../supabase/functions/_shared/atlasArrival');
    expect(todayFrom('2026-10-26')).toEqual({ date: '2026-10-26', weekday: 'Monday' });
    expect(todayFrom('garbage').date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('turns a local date and time into the right moment', async () => {
    const { localToIso } = await import('../../../supabase/functions/_shared/atlasArrival');
    // California is 420 minutes behind UTC in October.
    expect(localToIso('2026-10-31', '14:30', 420)).toBe('2026-10-31T21:30:00.000Z');
    expect(localToIso('2026-10-31', null, 420)).toBe('2026-10-31T07:00:00.000Z');
    expect(localToIso('2026-10-31', '09:00', -600)).toBe('2026-10-30T23:00:00.000Z');
  });

  it('finds the next weekday on or after a date', async () => {
    const { nextWeekday } = await import('../../../supabase/functions/_shared/atlasArrival');
    expect(nextWeekday('2026-10-26', 'Monday')).toBe('2026-10-26');
    expect(nextWeekday('2026-10-26', 'Saturday')).toBe('2026-10-31');
    expect(nextWeekday('2026-10-31', 'Monday')).toBe('2026-11-02');
  });
});

describe('extractJson', async () => {
  const { extractJson } = await import('../../../supabase/functions/_shared/atlasArrival');

  it('reads a plan that comes after some prose, as replies with web search do', () => {
    const raw = 'I checked the CompTIA site {for dates}. Here is the plan:\n{"goal":{"title":"Help desk job"},"phases":[{"title":"Study","steps":[{"title":"Book the exam"}]}]}\nGood luck.';
    expect(extractJson(raw)).toMatchObject({ goal: { title: 'Help desk job' } });
  });

  it('reads a fenced block, and copes with braces inside strings', () => {
    expect(extractJson('```json\n{"a":"x } y"}\n```')).toEqual({ a: 'x } y' });
    expect(extractJson('{"note":"use {braces}","n":1}')).toEqual({ note: 'use {braces}', n: 1 });
  });

  it('gives null for a reply cut off mid-JSON', () => {
    expect(extractJson('{"goal":{"title":"Help desk"},"phases":[{"title":"Stu')).toBeNull();
    expect(extractJson(null)).toBeNull();
  });
});
