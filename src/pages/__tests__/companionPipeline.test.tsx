import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const createRandomCompanion = vi.fn();
vi.mock('../../services/randomCompanionService', () => ({
  createRandomCompanion: (...a: unknown[]) => createRandomCompanion(...a),
  companionDestination: () => '/chat?companion=x',
  finishCompanionPipeline: vi.fn(),
}));
vi.mock('../../components/AvatarSaveReveal', () => ({
  AvatarSaveReveal: ({ companionName, buttonLabel, autoDismissMs, onContinue }: { companionName: string; buttonLabel: string; autoDismissMs: number; onContinue: () => void }) => (
    <div>meet {companionName}<span>auto:{String(autoDismissMs)}</span><button onClick={onContinue}>{buttonLabel}</button></div>
  ),
}));
vi.mock('../../shared/ui/Toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../shared/supabase/client', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: null } }) } } }));
vi.mock('../../services/userProfileService', () => ({ userProfileService: { getCurrentProfile: async () => ({ name: 'Tim' }) } }));
vi.mock('../../services/companionFromAnswers', () => ({ createCompanionFromAnswers: vi.fn() }));

import { CompanionPathSelectPage } from '../CompanionPathSelectPage';
import { QuestionnairePageV2 } from '../QuestionnairePageV2';

function Where() { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; }
const mount = (path: string, el: React.ReactNode) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path={path.split('?')[0]} element={el} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as unknown as MediaQueryList);
  createRandomCompanion.mockReset(); sessionStorage.clear();
});

describe('making someone: gender, then friend or companion, then build or surprise', () => {
  it('asks gender first, then friend or companion, then build or surprise, in the shell', async () => {
    mount('/companion-path', <CompanionPathSelectPage />);
    // Dez opens, the same for everyone, then asks
    expect(screen.getAllByText(/I'm also the matchmaker/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Let's do it"));
    expect((await screen.findAllByText('Who are you looking for?', {}, { timeout: 3000 })).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Male'));
    expect((await screen.findAllByText(/What kind of relationship do you want\?/, {}, { timeout: 3000 })).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Just a friend to talk to'));
    expect((await screen.findAllByText(/build your friend, or be surprised/, {}, { timeout: 3000 })).length).toBeGreaterThan(0);
  });

  it('does not ask friend or companion again when it was chosen on the way in', async () => {
    mount('/companion-path?kind=friend', <CompanionPathSelectPage />);
    fireEvent.click(screen.getByText("Let's do it"));
    fireEvent.click(await screen.findByText('Female', {}, { timeout: 3000 }));
    expect((await screen.findAllByText(/build your friend, or be surprised/, {}, { timeout: 3000 })).length).toBeGreaterThan(0);
    expect(screen.queryByText(/What kind of/)).toBeNull();
  });

  it('"build them myself" carries the gender and the kind to the questionnaire', async () => {
    mount('/companion-path', <CompanionPathSelectPage />);
    fireEvent.click(screen.getByText("Let's do it"));
    fireEvent.click(await screen.findByText('Female', {}, { timeout: 3000 }));
    fireEvent.click(await screen.findByText('Something more...', {}, { timeout: 3000 }));
    fireEvent.click(await screen.findByText('Build them myself', {}, { timeout: 3000 }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/questionnaire?gender=Female&type=romantic'), { timeout: 3000 });
  });

  it('"surprise me" makes the companion for that gender and kind, shows them with a button, and never opens the questionnaire', async () => {
    createRandomCompanion.mockResolvedValue({ id: 'c1', name: 'Levi', avatar: {}, to: '/chat?companion=c1' });
    mount('/companion-path?kind=friend', <CompanionPathSelectPage />);
    fireEvent.click(screen.getByText("Let's do it"));
    fireEvent.click(await screen.findByText('Male', {}, { timeout: 3000 }));
    fireEvent.click(await screen.findByText('Surprise me', {}, { timeout: 3000 }));
    await waitFor(() => expect(createRandomCompanion).toHaveBeenCalledWith('male', 'friend'), { timeout: 3000 });
    expect(await screen.findByText('meet Levi', {}, { timeout: 15000 })).toBeTruthy();
    // It waits for the person: no auto-dismiss, one button that goes to the chat.
    expect(screen.getByText('auto:0')).toBeTruthy();
    fireEvent.click(screen.getByText('Start chatting'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/chat?companion=c1'));
  }, 25000);
});

describe('the companion questionnaire (build your own)', () => {
  it('is sent to the start when gender and kind were not chosen, and by the old random link', async () => {
    mount('/questionnaire', <QuestionnairePageV2 />);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/companion-path'));
  });

  it('starts at the first real question without asking who or what kind again', () => {
    mount('/questionnaire?gender=Male&type=friend', <QuestionnairePageV2 />);
    expect(screen.queryAllByText('Who are you looking for?')).toHaveLength(0);
    expect(screen.getAllByText(/Is he the life of the party/).length).toBeGreaterThan(0);
  });
});
