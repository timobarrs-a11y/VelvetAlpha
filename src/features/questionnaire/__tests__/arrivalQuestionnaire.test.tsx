import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { PERSONAL_QUESTIONNAIRE, resolveZodiac, somedayFromAnswers, answersFromSomeday, SOMEDAY_TABS } from '../personalBank';
import { answersFromProfile, profileUpdateFor, resumeIndex } from '../arrivalAnswers';
import { QuestionnaireShell } from '../QuestionnaireShell';
import { makeContext } from '../pronouns';
import { validateNickname } from '../nicknames';
import type { QuestionnaireDefinition } from '../types';

const ctx = makeContext({}, '', 'user');
const ids = PERSONAL_QUESTIONNAIRE.questions.map(q => q.id);

describe('Act 1 order', () => {
  it('goes nickname, color, birthday, zodiac, gender, interests, Someday, the four wavelength questions, favorite hero, then the real name', () => {
    expect(ids).toEqual(['nickname', 'favoriteColor', 'birthday', 'zodiacCusp', 'zodiacConfirm', 'gender', 'interests', 'someday', 'conflictResponse', 'connection', 'decisionStyle', 'motivation', 'favoriteHero', 'name']);
  });

  it('asks for a nickname first, and requires one', () => {
    const q = PERSONAL_QUESTIONNAIRE.questions[0] as { id: string; question: string; optional?: boolean; nicknameBank?: boolean; validate?: (t: string) => string | null };
    expect(q.id).toBe('nickname');
    expect(q.question).toBe("Hey, I'm Dez! We don't call ya by your first name around here, what do people call you?");
    expect(q.optional).toBeFalsy();
    expect(q.nicknameBank).toBe(true);
    expect(q.validate!('me@mail.com')).not.toBeNull();
    expect(q.validate!('Sunny Otter')).toBeNull();
  });

  it('asks for the real name last, as optional', () => {
    const q = PERSONAL_QUESTIONNAIRE.questions.find(x => x.id === 'name') as unknown as { id: string; optional?: boolean; skipLabel?: string; hint?: string | ((c: unknown) => string) };
    expect(q.id).toBe('name');
    expect(q.optional).toBe(true);
    expect(q.skipLabel).toBe('Skip for now');
    expect(q.hint).toMatch(/Only Atlas uses it/);
  });

  it('greets them by nickname', () => {
    const q = PERSONAL_QUESTIONNAIRE.questions.find(x => x.id === 'name') as unknown as { question: (c: unknown) => string };
    const text = q.question({ ...ctx, answers: { nickname: 'Ace' } });
    expect(text).toBe('Alright, Ace, last question. Atlas needs to know your first name.');
  });

  it('no longer has the swipe deck (the wavelength questions are back, in Dez\'s voice)', () => {
    expect(ids).not.toContain('tasteDeck');
  });

  it('skips the birthday when sign-up already gave it, and shows only the right zodiac question', () => {
    const q = (id: string) => PERSONAL_QUESTIONNAIRE.questions.find(x => x.id === id)!;
    const onCusp = { ...ctx, answers: { birthday: '1990-03-20' } };
    const offCusp = { ...ctx, answers: { birthday: '1990-10-29' } };
    expect(q('birthday').skipIf!(offCusp)).toBe(true);
    expect(q('birthday').skipIf!({ ...ctx, answers: {} })).toBe(false);
    expect([q('zodiacCusp').skipIf!(onCusp), q('zodiacConfirm').skipIf!(onCusp)]).toEqual([false, true]);
    expect([q('zodiacCusp').skipIf!(offCusp), q('zodiacConfirm').skipIf!(offCusp)]).toEqual([true, false]);
  });
});

describe('resolveZodiac', () => {
  it('uses the sign chosen on a cusp (it used to be ignored)', () => {
    expect(resolveZodiac({ birthday: '1990-03-20', zodiacCusp: 'Aries' })).toBe('Aries');
  });

  it('uses the confirmed sign, or none when they opt out', () => {
    expect(resolveZodiac({ birthday: '1990-10-29', zodiacConfirm: 'Scorpio' })).toBe('Scorpio');
    expect(resolveZodiac({ birthday: '1990-10-29', zodiacConfirm: 'none' })).toBeNull();
    expect(resolveZodiac({ birthday: '1990-10-29' })).toBe('Scorpio');
  });
});

describe('Someday picks', () => {
  it('become the saved list and come back again', () => {
    const answers = { someday_work: ['Tech & IT', 'Run a bakery'], someday_skills: ['Learn to code'] };
    const picks = somedayFromAnswers(answers);
    expect(picks).toEqual([
      { tab: 'Work', value: 'Tech & IT' },
      { tab: 'Work', value: 'Run a bakery', custom: true },
      { tab: 'Skills', value: 'Learn to code' },
    ]);
    expect(answersFromSomeday(picks)).toEqual(answers);
  });

  it('has a nudge on every tab and verb-first options', () => {
    expect(SOMEDAY_TABS.every(t => t.nudge.length > 0 && t.options.length >= 5)).toBe(true);
    expect(SOMEDAY_TABS.find(t => t.id === 'work')!.options).toContain('Tech & IT');
  });
});

describe('saving each answer', () => {
  it('writes the matching profile column', () => {
    expect(profileUpdateFor('name', 'Tim', {})).toEqual({ name: 'Tim' });
    expect(profileUpdateFor('nickname', '  ', {})).toEqual({ nickname: null });
    expect(profileUpdateFor('zodiacConfirm', 'none', {})).toEqual({ zodiac_sign: null });
    expect(profileUpdateFor('musicGenre', ['Jazz', 'Pop'], {})).toEqual({ music_genre: 'Jazz, Pop' });
    expect(profileUpdateFor('sportsInterests', ['Basketball'], {})).toEqual({ sports_interests: ['Basketball'], sports: ['Basketball'] });
    expect(profileUpdateFor('someday_body', ['Run a 5K'], { someday_body: ['Run a 5K'] })).toEqual({ someday: [{ tab: 'Body', value: 'Run a 5K' }] });
  });

  it('never writes the birthday, which only sign-up may set', () => {
    expect(profileUpdateFor('birthday', '1990-10-29', {})).toBeNull();
  });
});

describe('resuming', () => {
  it('starts at the first question not yet answered', () => {
    const answers = answersFromProfile({ nickname: 'Ace', favorite_color: 'Teal', birthday: '1990-10-29' } as never);
    expect(PERSONAL_QUESTIONNAIRE.questions[resumeIndex(PERSONAL_QUESTIONNAIRE, answers, ctx)].id).toBe('zodiacConfirm');
  });

  it('asks the favorite hero next once everything before it is answered', () => {
    const answers = answersFromProfile({
      nickname: 'Ace', favorite_color: 'Teal', birthday: '1990-10-29', zodiac_sign: 'Scorpio', gender: 'Male',
      hobbies: ['Hiking', 'Cooking', 'Reading'], someday: [{ tab: 'Work', value: 'Tech & IT' }],
      communication_profile: { conflict: 'solutions', connection: 'deep', decisionStyle: 'intuitive', motivation: 'internal' },
    } as never);
    expect(PERSONAL_QUESTIONNAIRE.questions[resumeIndex(PERSONAL_QUESTIONNAIRE, answers, ctx)].id).toBe('favoriteHero');
  });

  it('sends someone who only gave a real name back to choose a nickname', () => {
    const answers = answersFromProfile({ name: 'Tim', favorite_color: 'Teal', birthday: '1990-10-29' } as never);
    expect(PERSONAL_QUESTIONNAIRE.questions[resumeIndex(PERSONAL_QUESTIONNAIRE, answers, ctx)].id).toBe('nickname');
  });

  it('treats a skipped real name as done once a later answer exists', () => {
    const answers = answersFromProfile({ nickname: 'Ace', favorite_color: 'Teal', birthday: '1990-10-29', zodiac_sign: 'Scorpio', gender: 'Male' } as never);
    expect(PERSONAL_QUESTIONNAIRE.questions[resumeIndex(PERSONAL_QUESTIONNAIRE, answers, ctx)].id).toBe('interests');
  });

  it('ignores placeholder names', () => {
    expect(answersFromProfile({ name: 'there' } as never).name).toBeUndefined();
  });
});

describe('the nickname screen in the shell', () => {
  const definition: QuestionnaireDefinition = {
    chapters: [{ id: 'c', label: 'Chapter', questionIds: ['nickname'] }],
    questions: [PERSONAL_QUESTIONNAIRE.questions[0]],
  };
  const renderIt = (onAnswer = vi.fn(), onComplete = vi.fn()) => render(
    <QuestionnaireShell definition={definition} context={ctx} onAnswer={onAnswer} onComplete={onComplete} />,
  );

  it('shows the nickname bank to pick one from, by flavor', () => {
    renderIt();
    expect(screen.getByText(/No nickname\? Create one now!/)).toBeTruthy();
    const tabs = screen.getAllByRole('tab').map(t => t.textContent);
    expect(tabs).toEqual(['Funny', 'Classic', 'Screen names', 'Cozy']);
    expect(screen.getByRole('option', { name: 'Captain Snacks' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Classic' }));
    expect(screen.getByRole('option', { name: 'Ace' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Captain Snacks' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Screen names' }));
    expect(screen.getByRole('option', { name: 'NightOwl' })).toBeTruthy();
  });

  it('picks the one they tap, and they can still change it', () => {
    renderIt();
    const box = screen.getByPlaceholderText('Your nickname') as HTMLInputElement;
    fireEvent.click(screen.getByRole('option', { name: 'Captain Snacks' }));
    expect(box.value).toBe('Captain Snacks');
    expect(screen.getByRole('option', { name: 'Captain Snacks' }).getAttribute('aria-selected')).toBe('true');
    expect((screen.getByText('Next') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(box, { target: { value: 'Ace' } });
    expect(box.value).toBe('Ace');
  });

  it('gives them a random nickname and moves on when they skip', async () => {
    const onAnswer = vi.fn();
    renderIt(onAnswer);
    fireEvent.click(screen.getByText('Skip, pick one for me'));
    await waitFor(() => expect(onAnswer).toHaveBeenCalled());
    const [id, nickname] = onAnswer.mock.calls[0];
    expect(id).toBe('nickname');
    expect(String(nickname).length).toBeGreaterThan(1);
    expect(validateNickname(String(nickname))).toBeNull();
  });

  it('will not accept an email or link, and says why', () => {
    renderIt();
    const box = screen.getByPlaceholderText('Your nickname');
    fireEvent.change(box, { target: { value: 'me@mail.com' } });
    expect(screen.getByRole('alert').textContent).toMatch(/Leave out emails/);
    expect((screen.getByText('Next') as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves the nickname they typed', async () => {
    const onAnswer = vi.fn();
    renderIt(onAnswer);
    fireEvent.change(screen.getByPlaceholderText('Your nickname'), { target: { value: 'Ace' } });
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith('nickname', 'Ace', expect.anything()));
  });
});

describe('a tabbed screen in the shell', () => {
  const definition: QuestionnaireDefinition = {
    chapters: [{ id: 'c', label: 'Chapter', questionIds: ['picks'] }],
    questions: [{
      id: 'picks',
      archetype: 'tabs',
      question: 'What are you into?',
      minSelections: 2,
      tabs: [
        { id: 'a', label: 'Hobbies', answerKey: 'hobbies', options: [{ label: 'Reading', value: 'Reading' }, { label: 'Hiking', value: 'Hiking' }] },
        { id: 'b', label: 'Music', answerKey: 'musicGenre', nudge: 'What you play loud', options: [{ label: 'Jazz', value: 'Jazz' }], allowCustom: true },
      ],
    }],
  };

  it('saves each tab under its own key, with picks across tabs counting toward the minimum', async () => {
    const onAnswer = vi.fn();
    const onComplete = vi.fn();
    render(<QuestionnaireShell definition={definition} context={ctx} onAnswer={onAnswer} onComplete={onComplete} />);

    fireEvent.click(screen.getByText('Reading'));
    expect((screen.getByText('Next') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Pick 1 more')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Music/ }));
    expect(screen.getByText('What you play loud')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Add your own to Music'), { target: { value: 'Afrobeats' } });
    fireEvent.click(screen.getByLabelText('Add'));
    fireEvent.click(screen.getByText('Next'));

    expect(onAnswer).toHaveBeenCalledWith('hobbies', ['Reading'], expect.any(Object));
    expect(onAnswer).toHaveBeenCalledWith('musicGenre', ['Afrobeats'], expect.any(Object));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete.mock.calls[0][0]).toMatchObject({ hobbies: ['Reading'], musicGenre: ['Afrobeats'] });
  });

  it('starts from saved answers when resuming', () => {
    render(<QuestionnaireShell definition={definition} context={ctx} onComplete={vi.fn()} initialAnswers={{ hobbies: ['Hiking'], musicGenre: ['Jazz'] }} />);
    expect(screen.getByText('Hiking').closest('button')!.getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByText('Next') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('the favorite superhero question', () => {
  const q = () => PERSONAL_QUESTIONNAIRE.questions.find(x => x.id === 'favoriteHero') as unknown as { question: string; optional?: boolean; suggestions?: string[]; validate?: (t: string) => string | null; hint?: string };

  it('is optional, suggests heroes, and says where it shows', () => {
    expect(q().question).toBe("Every town needs its heroes. Who's your favorite superhero?");
    expect(q().optional).toBe(true);
    expect(q().suggestions).toContain('Wonder Woman');
    expect(q().suggestions!.length).toBeGreaterThanOrEqual(24);
    expect(q().hint).toMatch(/profile and your billboard/);
  });

  it('takes any hero but not emails or links, or an essay', () => {
    expect(q().validate!('Squirrel Girl')).toBeNull();
    expect(q().validate!('me@mail.com')).not.toBeNull();
    expect(q().validate!('https://example.com')).not.toBeNull();
    expect(q().validate!('x'.repeat(61))).not.toBeNull();
  });

  it('saves with the profile and comes back when resuming, and skipping clears it', () => {
    expect(profileUpdateFor('favoriteHero', ' Storm ', {})).toEqual({ favorite_superhero: 'Storm' });
    expect(profileUpdateFor('favoriteHero', '', {})).toEqual({ favorite_superhero: null });
    expect(answersFromProfile({ favorite_superhero: 'Storm' } as never).favoriteHero).toBe('Storm');
  });

  it('shows suggestions on the screen and fills the box when one is tapped', async () => {
    const def: QuestionnaireDefinition = { startProgress: 10, chapters: [{ id: 'c', label: 'C', questionIds: ['favoriteHero'] }], questions: [PERSONAL_QUESTIONNAIRE.questions.find(x => x.id === 'favoriteHero')!] };
    const onAnswer = vi.fn();
    render(<QuestionnaireShell definition={def} context={ctx} onAnswer={onAnswer} onComplete={() => {}} />);
    fireEvent.click(await screen.findByText('Wonder Woman'));
    expect((screen.getByPlaceholderText('Type a hero, or pick one below') as HTMLInputElement).value).toBe('Wonder Woman');
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith('favoriteHero', 'Wonder Woman', expect.anything()));
  });
});

describe('going back to change a pick', () => {
  it('lets you change the color: going back does not push you forward again', async () => {
    vi.useFakeTimers();
    try {
      const onAnswer = vi.fn();
      const def: QuestionnaireDefinition = { ...PERSONAL_QUESTIONNAIRE, questions: PERSONAL_QUESTIONNAIRE.questions.slice(0, 3) };
      render(<QuestionnaireShell definition={def} context={ctx} initialAnswers={{ nickname: 'Ace' }} initialIndex={1} onAnswer={onAnswer} onComplete={() => {}} />);
      expect(screen.getByText(/favorite color/)).toBeTruthy();

      fireEvent.click(screen.getByText('Teal'));
      act(() => { vi.advanceTimersByTime(1200); });
      expect(onAnswer).toHaveBeenCalledWith('favoriteColor', 'Teal', expect.anything());
      // Back to the color: the old pick is shown, and nothing moves on without a new pick.
      fireEvent.click(screen.getByText('Back'));
      act(() => { vi.advanceTimersByTime(3000); });
      expect(screen.getByText(/favorite color/)).toBeTruthy();
      expect(onAnswer).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('Blue'));
      act(() => { vi.advanceTimersByTime(1200); });
      expect(onAnswer).toHaveBeenLastCalledWith('favoriteColor', 'Blue', expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the sign-up birthday questions say where the birthday came from', () => {
  const q = (id: string) => PERSONAL_QUESTIONNAIRE.questions.find(x => x.id === id) as unknown as { question: string | ((c: unknown) => string) };
  it('names the sign-up birthday on the cusp and the confirm questions', () => {
    expect(q('zodiacCusp').question).toMatch(/birthday you gave at sign-up/);
    const confirm = (q('zodiacConfirm').question as (c: unknown) => string)({ ...ctx, answers: { birthday: '1990-10-29' } });
    expect(confirm).toBe("Going by your sign-up birthday, you're a Scorpio ♏. Sound right?");
  });
});

describe('Dez hosting the questions', () => {
  const host = { name: 'Dez', title: 'Mayor of Town', portrait: <span>portrait</span> };
  const def: QuestionnaireDefinition = { startProgress: 10, chapters: [{ id: 'c', label: 'C', questionIds: ['nickname'] }], questions: [PERSONAL_QUESTIONNAIRE.questions[0]] };

  it('types the line out, keeps the answer controls back until it is said, and tapping finishes it', () => {
    vi.useFakeTimers();
    try {
      render(<QuestionnaireShell definition={def} context={ctx} host={host} onComplete={() => {}} />);
      // everyone can read the whole line from the start; the visible text types out
      expect(screen.getByText("Hey, I'm Dez! We don't call ya by your first name around here, what do people call you?")).toBeTruthy();
      expect(screen.getByText('Dez')).toBeTruthy();
      expect(screen.getByText('Mayor of Town')).toBeTruthy();
      const controls = screen.getByPlaceholderText('Your nickname').closest('div[style]') as HTMLElement;
      expect(controls.style.opacity).toBe('0');
      expect(controls.style.pointerEvents).toBe('none');

      act(() => { vi.advanceTimersByTime(800); });
      expect(controls.style.opacity).toBe('0');

      fireEvent.click(screen.getByTestId('host-dialogue'));
      expect(controls.style.opacity).toBe('1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reveals the controls by itself once the line has been typed', () => {
    vi.useFakeTimers();
    try {
      render(<QuestionnaireShell definition={def} context={ctx} host={host} onComplete={() => {}} />);
      act(() => { vi.advanceTimersByTime(8000); });
      const controls = screen.getByPlaceholderText('Your nickname').closest('div[style]') as HTMLElement;
      expect(controls.style.opacity).toBe('1');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the wavelength questions (how you tick)', () => {
  it('are two-way taps that save into the profile as they are answered, and come back on resume', () => {
    const q = (id: string) => PERSONAL_QUESTIONNAIRE.questions.find(x => x.id === id) as unknown as { options: { value: string }[]; autoAdvance?: boolean };
    expect(q('conflictResponse').options.map(o => o.value)).toEqual(['solutions', 'empathy']);
    expect(q('connection').options.map(o => o.value)).toEqual(['deep', 'lively']);
    expect(q('decisionStyle').options.map(o => o.value)).toEqual(['intuitive', 'analytical']);
    expect(q('motivation').options.map(o => o.value)).toEqual(['internal', 'external']);

    expect(profileUpdateFor('conflictResponse', 'empathy', { conflictResponse: 'empathy' })).toEqual({ communication_profile: { conflict: 'empathy' } });
    expect(profileUpdateFor('motivation', 'external', { conflictResponse: 'empathy', motivation: 'external' }))
      .toEqual({ communication_profile: { conflict: 'empathy', motivation: 'external' } });

    const back = answersFromProfile({ communication_profile: { conflict: 'solutions', decisionStyle: 'analytical' } } as never);
    expect(back).toMatchObject({ conflictResponse: 'solutions', decisionStyle: 'analytical' });
    expect(back.connection).toBeUndefined();
  });

  it('use the same values Atlas and the coaches read', async () => {
    const { TRAITS } = await import('../../../../supabase/functions/_shared/atlasArrival');
    const q = (id: string) => (PERSONAL_QUESTIONNAIRE.questions.find(x => x.id === id) as unknown as { options: { value: string }[] }).options.map(o => o.value);
    expect(q('conflictResponse')).toEqual(TRAITS.conflict.values);
    expect(q('connection')).toEqual(TRAITS.connection.values);
    expect(q('decisionStyle')).toEqual(TRAITS.decisionStyle.values);
    expect(q('motivation')).toEqual(TRAITS.motivation.values);
  });
});
