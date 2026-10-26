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
  it('goes name, color, nickname, birthday, zodiac, gender, interests, Someday', () => {
    expect(ids).toEqual(['name', 'favoriteColor', 'nickname', 'birthday', 'zodiacCusp', 'zodiacConfirm', 'gender', 'interests', 'someday']);
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
    const answers = answersFromProfile({ name: 'Tim', favorite_color: 'Teal', birthday: '1990-10-29' } as never);
    expect(PERSONAL_QUESTIONNAIRE.questions[resumeIndex(PERSONAL_QUESTIONNAIRE, answers, ctx)].id).toBe('nickname');
  });

  it('treats a skipped nickname as done once a later answer exists', () => {
    const answers = answersFromProfile({ name: 'Tim', favorite_color: 'Teal', birthday: '1990-10-29', zodiac_sign: 'Scorpio', gender: 'Male' } as never);
    expect(PERSONAL_QUESTIONNAIRE.questions[resumeIndex(PERSONAL_QUESTIONNAIRE, answers, ctx)].id).toBe('interests');
  });

  it('ignores placeholder names', () => {
    expect(answersFromProfile({ name: 'there' } as never).name).toBeUndefined();
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
