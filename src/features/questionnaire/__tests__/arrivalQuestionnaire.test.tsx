import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PERSONAL_QUESTIONNAIRE, resolveZodiac, somedayFromAnswers, answersFromSomeday, SOMEDAY_TABS } from '../personalBank';
import { answersFromProfile, profileUpdateFor, resumeIndex } from '../arrivalAnswers';
import { QuestionnaireShell } from '../QuestionnaireShell';
import { makeContext } from '../pronouns';
import type { QuestionnaireDefinition } from '../types';

const ctx = makeContext({}, '', 'user');
const ids = PERSONAL_QUESTIONNAIRE.questions.map(q => q.id);

describe('Act 1 order', () => {
  it('goes nickname, real name, color, birthday, zodiac, gender, interests, Someday', () => {
    expect(ids).toEqual(['nickname', 'name', 'favoriteColor', 'birthday', 'zodiacCusp', 'zodiacConfirm', 'gender', 'interests', 'someday']);
  });

  it('asks for a nickname first, and requires one', () => {
    const q = PERSONAL_QUESTIONNAIRE.questions[0] as { id: string; question: string; optional?: boolean; pickForMe?: boolean; validate?: (t: string) => string | null };
    expect(q.id).toBe('nickname');
    expect(q.question).toBe("We don't like to call people by their first names here, what do people call you?");
    expect(q.optional).toBeFalsy();
    expect(q.pickForMe).toBe(true);
    expect(q.validate!('me@mail.com')).not.toBeNull();
    expect(q.validate!('Sunny Otter')).toBeNull();
  });

  it('asks for the real name second, as optional, and says it is only shown if they choose', () => {
    const q = PERSONAL_QUESTIONNAIRE.questions[1] as { id: string; optional?: boolean; skipLabel?: string; hint?: string | ((c: unknown) => string) };
    expect(q.id).toBe('name');
    expect(q.optional).toBe(true);
    expect(q.skipLabel).toBe('Skip for now');
    expect(q.hint).toMatch(/Optional/);
  });

  it('greets them by nickname', () => {
    const q = PERSONAL_QUESTIONNAIRE.questions[1] as { question: (c: unknown) => string };
    expect(q.question({ ...ctx, answers: { nickname: 'Ace' } })).toBe("Nice to meet you, Ace. We won't show this to anyone without your permission, but what's your real name?");
  });

  it('no longer asks the wavelength questions or the swipe deck', () => {
    for (const gone of ['conflictResponse', 'connection', 'decisionStyle', 'motivation', 'tasteDeck']) expect(ids).not.toContain(gone);
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

  it('has one "Pick one for me" button, no list of ideas, and a hint for people without a nickname', () => {
    renderIt();
    expect(screen.getByText(/No nickname\? Create one now!/)).toBeTruthy();
    expect(screen.queryByText(/Show me more/)).toBeNull();
    expect(screen.queryByText(/Need an idea/)).toBeNull();
    const box = screen.getByPlaceholderText('Your nickname') as HTMLInputElement;
    expect(box.value).toBe('');
    fireEvent.click(screen.getByText('Pick one for me'));
    const first = box.value;
    expect(first.length).toBeGreaterThan(1);
    expect((screen.getByText('Next') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByText('Pick one for me'));
    expect(box.value).not.toBe(first);
  });

  it('lets them change the picked nickname', () => {
    renderIt();
    const box = screen.getByPlaceholderText('Your nickname') as HTMLInputElement;
    fireEvent.click(screen.getByText('Pick one for me'));
    fireEvent.change(box, { target: { value: 'Ace' } });
    expect(box.value).toBe('Ace');
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
