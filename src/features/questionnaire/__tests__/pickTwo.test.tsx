import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuestionnaireShell } from '../QuestionnaireShell';
import { COMPANION_QUESTIONNAIRE } from '../companionBank';
import { makeContext } from '../pronouns';

const humor = COMPANION_QUESTIONNAIRE.questions.find(q => q.id === 'humor')!;
const only = { startProgress: 0, chapters: [{ id: 'energy', label: 'Who she is', questionIds: ['humor'] }], questions: [humor] };

// People are rarely one thing: the humor question takes a main style and, if they like, a second.
describe('the humor question', () => {
  const setup = () => {
    const onComplete = vi.fn();
    render(<QuestionnaireShell definition={only} context={makeContext({}, 'Female', 'companion')} onComplete={onComplete} />);
    return onComplete;
  };

  it('saves the picks in the order they were tapped, main one first', async () => {
    const onComplete = setup();
    fireEvent.click(screen.getByText(/Aw, come here/));
    fireEvent.click(screen.getByText(/turned breakfast into a fire drill/));
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete.mock.calls[0][0].humor).toEqual(['warm', 'witty']);
  });

  it('takes one pick on its own', async () => {
    const onComplete = setup();
    fireEvent.click(screen.getByText(/Crispy/));
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete.mock.calls[0][0].humor).toEqual(['dry']);
  });

  it('stops at two, can be changed, and will not go on with none', async () => {
    const onComplete = setup();
    const next = () => screen.getByText('Next') as HTMLButtonElement;
    expect(next().disabled).toBe(true);
    fireEvent.click(screen.getByText(/Crispy/));
    fireEvent.click(screen.getByText(/BREAKING NEWS/));
    fireEvent.click(screen.getByText(/Aw, come here/)); // a third: ignored
    fireEvent.click(screen.getByText(/BREAKING NEWS/)); // take the second back
    fireEvent.click(screen.getByText(/Aw, come here/));
    fireEvent.click(next());
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete.mock.calls[0][0].humor).toEqual(['dry', 'warm']);
  });
});

describe('Dez\'s remark after an answer', () => {
  const host = { name: 'Dez', title: 'Mayor of Town', portrait: null };
  const def = {
    startProgress: 0,
    chapters: [{ id: 'c', label: 'Who', questionIds: ['directness', 'care'] }],
    questions: ['directness', 'care'].map(id => COMPANION_QUESTIONNAIRE.questions.find(q => q.id === id)!),
  };

  it('is said, then the next question comes up; and without a host there is no remark', async () => {
    vi.setConfig({ testTimeout: 30000 });
    const onComplete = vi.fn();
    render(<QuestionnaireShell definition={def} host={host} context={makeContext({}, 'Female', 'companion')} onComplete={onComplete} />);
    // the first question, and its slider answer
    expect((await screen.findAllByText(/haircut/, {}, { timeout: 8000 })).length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByText('Next', {}, { timeout: 8000 }));
    // the remark for "tactful, but honest" (the slider's middle), then the next question
    expect((await screen.findAllByText(/Tactful but honest/, {}, { timeout: 8000 })).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/wrecked after a bad day/, {}, { timeout: 12000 })).length).toBeGreaterThan(0);
  });
});
