import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const createRandomCompanion = vi.fn();
vi.mock('../../services/randomCompanionService', () => ({
  createRandomCompanion: (...a: unknown[]) => createRandomCompanion(...a),
  companionDestination: () => '/chat?companion=x',
  finishCompanionPipeline: vi.fn(),
}));
vi.mock('../../components/AvatarSaveReveal', () => ({ AvatarSaveReveal: ({ companionName }: { companionName: string }) => <div>meet {companionName}</div> }));
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
      {/* the page under test is served at its own path; everything else just reports where we ended up */}
      <Route path={path.split('?')[0]} element={el} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  window.matchMedia = window.matchMedia ?? ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as unknown as MediaQueryList);
  createRandomCompanion.mockReset(); sessionStorage.clear(); vi.useRealTimers(); });

describe('the companion pipeline: friend or companion, then male or female, then your own or random', () => {
  it('goes back to friend or companion when that was not chosen', async () => {
    mount('/companion-path', <CompanionPathSelectPage />);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/intent-select?people=1'));
  });

  it('asks male or female first, then your own or random', async () => {
    sessionStorage.setItem('onboardingRelationshipType', 'friend');
    mount('/companion-path', <CompanionPathSelectPage />);
    expect(screen.getByText('Who Are You Looking For?')).toBeTruthy();
    expect(screen.queryByText('Build Your Own')).toBeNull();
    fireEvent.click(screen.getByText('Male'));
    expect(await screen.findByText('Build Your Own')).toBeTruthy();
    expect(screen.getByText('From Inside the Velvet Rope')).toBeTruthy();
    expect(screen.getByText('Create Your Friend')).toBeTruthy();
  });

  it('"create your own" carries the gender and the kind of connection to the questionnaire', async () => {
    sessionStorage.setItem('onboardingRelationshipType', 'romantic');
    mount('/companion-path', <CompanionPathSelectPage />);
    fireEvent.click(screen.getByText('Female'));
    fireEvent.click(await screen.findByText('Build Your Own'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/questionnaire?gender=Female&type=romantic'), { timeout: 3000 });
  });

  it('"random" makes the companion for that gender and kind, and never opens the questionnaire', async () => {
    createRandomCompanion.mockResolvedValue({ id: 'c1', name: 'Levi', avatar: {}, to: '/chat?companion=c1' });
    sessionStorage.setItem('onboardingRelationshipType', 'friend');
    mount('/companion-path', <CompanionPathSelectPage />);
    fireEvent.click(screen.getByText('Male'));
    fireEvent.click(await screen.findByText('From Inside the Velvet Rope'));
    await waitFor(() => expect(createRandomCompanion).toHaveBeenCalledWith('male', 'friend'), { timeout: 3000 });
    expect(await screen.findByText('meet Levi', {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull();
  }, 20000);
});

describe('the companion questionnaire', () => {
  it('is never shown without the gender and kind already chosen, nor for the old random link', async () => {
    mount('/questionnaire', <QuestionnairePageV2 />);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/intent-select?people=1'));
  });

  it('is sent back to the start by the old random link (?mode=velvet)', async () => {
    mount('/questionnaire?mode=velvet&gender=Male&type=friend', <QuestionnairePageV2 />);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/intent-select?people=1'));
  });

  it('starts at the first real question, in the chosen gender\'s words, without asking who or what kind again', () => {
    mount('/questionnaire?gender=Male&type=friend', <QuestionnairePageV2 />);
    expect(screen.queryByText('Who are you looking for?')).toBeNull();
    expect(screen.queryByText(/What kind of (friendship|relationship)/)).toBeNull();
    expect(screen.getByText(/Is he the life of the party/)).toBeTruthy();
  });
});
