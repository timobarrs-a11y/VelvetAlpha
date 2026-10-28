import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const rollRandomCandidate = vi.fn();
const saveRandomCandidate = vi.fn();
vi.mock('../../services/randomCompanionService', () => ({
  rollRandomCandidate: (...a: unknown[]) => rollRandomCandidate(...a),
  saveRandomCandidate: (...a: unknown[]) => saveRandomCandidate(...a),
  companionDestination: () => '/chat?companion=x',
  finishCompanionPipeline: vi.fn(),
}));
vi.mock('../../components/AvatarV2', () => ({ AvatarV2: () => <div data-testid="avatar" /> }));
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

// Dez says a line after each answer before the next question, so a walk through takes a few seconds.
vi.setConfig({ testTimeout: 40000 });

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as unknown as MediaQueryList);
  rollRandomCandidate.mockReset(); saveRandomCandidate.mockReset(); sessionStorage.clear();
});

describe('making someone: gender, then friend or companion, then build or matchmake', () => {
  it('asks gender first, then friend or companion, then build or matchmake, in the shell', async () => {
    mount('/companion-path', <CompanionPathSelectPage />);
    // Dez opens, the same for everyone, then asks
    expect(screen.getAllByText(/I'm also the matchmaker/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Let's get 'er done"));
    expect((await screen.findAllByText('Who are you looking for?', {}, { timeout: 9000 })).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Male'));
    expect((await screen.findAllByText(/What kind of relationship do you want\?/, {}, { timeout: 9000 })).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Just a friend to talk to'));
    expect((await screen.findAllByText(/build your friend, or should I matchmake for you/, {}, { timeout: 9000 })).length).toBeGreaterThan(0);
  });

  it('does not ask friend or companion again when it was chosen on the way in', async () => {
    mount('/companion-path?kind=friend', <CompanionPathSelectPage />);
    fireEvent.click(screen.getByText("Let's get 'er done"));
    fireEvent.click(await screen.findByText('Female', {}, { timeout: 9000 }));
    expect((await screen.findAllByText(/build your friend, or should I matchmake for you/, {}, { timeout: 9000 })).length).toBeGreaterThan(0);
    expect(screen.queryByText(/What kind of/)).toBeNull();
  });

  it('"build them myself" carries the gender and the kind to the questionnaire', async () => {
    mount('/companion-path', <CompanionPathSelectPage />);
    fireEvent.click(screen.getByText("Let's get 'er done"));
    fireEvent.click(await screen.findByText('Female', {}, { timeout: 9000 }));
    fireEvent.click(await screen.findByText('Something more...', {}, { timeout: 9000 }));
    fireEvent.click(await screen.findByText('Build them myself', {}, { timeout: 9000 }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/questionnaire?gender=Female&type=romantic'), { timeout: 9000 });
  });

  const candidate = (name: string) => ({ gender: 'male', connection: 'friend', answers: {}, name, voiceId: 'jock', avatar: {} });

  it('"matchmake for me" picks a match for that gender and kind, shows the card, saves nothing yet, and never opens the questionnaire', async () => {
    rollRandomCandidate.mockReturnValue(candidate('Levi'));
    mount('/companion-path?kind=friend', <CompanionPathSelectPage />);
    fireEvent.click(screen.getByText("Let's get 'er done"));
    fireEvent.click(await screen.findByText('Male', {}, { timeout: 9000 }));
    fireEvent.click(await screen.findByText('Matchmake for me', {}, { timeout: 9000 }));
    await waitFor(() => expect(rollRandomCandidate).toHaveBeenCalledWith('male', 'friend'), { timeout: 9000 });
    expect(await screen.findByText('Meet Levi.', {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.getByText('THE JOCK')).toBeTruthy();
    expect(screen.getByTestId('avatar')).toBeTruthy();
    expect(saveRandomCandidate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('where')).toBeNull();
  });

  it('"someone else" searches again and keeps nothing; "yes" saves the one on screen and opens the chat', async () => {
    rollRandomCandidate.mockReturnValueOnce(candidate('Levi')).mockReturnValueOnce(candidate('Reed'));
    saveRandomCandidate.mockResolvedValue({ id: 'c2', name: 'Reed', avatar: {}, to: '/chat?companion=c2' });
    mount('/companion-path?kind=friend', <CompanionPathSelectPage />);
    fireEvent.click(screen.getByText("Let's get 'er done"));
    fireEvent.click(await screen.findByText('Male', {}, { timeout: 9000 }));
    fireEvent.click(await screen.findByText('Matchmake for me', {}, { timeout: 9000 }));
    fireEvent.click(await screen.findByText('Show me someone else', {}, { timeout: 15000 }));
    expect(saveRandomCandidate).not.toHaveBeenCalled();
    expect(await screen.findByText('Meet Reed.', {}, { timeout: 15000 })).toBeTruthy();
    fireEvent.click(screen.getByText('Yes, this is my friend'));
    await waitFor(() => expect(saveRandomCandidate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Reed' })));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/chat?companion=c2'));
  });
});

describe('the companion questionnaire (build your own)', () => {
  it('is sent to the start when gender and kind were not chosen, and by the old random link', async () => {
    mount('/questionnaire', <QuestionnairePageV2 />);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/companion-path'));
  });

  it('starts at the first real question without asking who or what kind again', () => {
    mount('/questionnaire?gender=Male&type=friend', <QuestionnairePageV2 />);
    expect(screen.queryAllByText('Who are you looking for?')).toHaveLength(0);
    expect(screen.getAllByText(/Picture him walking into a party/).length).toBeGreaterThan(0);
  });
});
