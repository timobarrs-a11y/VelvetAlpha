import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { ToastContainer } from './shared/ui/Toast';
import { FirstPostWatcher } from './components/FirstPostWatcher';
import { GoalNotesWatcher } from './components/GoalNotesWatcher';
import { RootRedirect } from './routes/rootRedirect';
import { publicRoutes } from './routes/publicRoutes';
import { onboardingRoutes } from './routes/onboardingRoutes';
import { appRoutes } from './routes/appRoutes';
import { adminRoutes } from './routes/adminRoutes';
import { gamesRoutes } from './routes/gamesRoutes';
import { useCustomization } from './hooks/useCustomization';
import { useAuth } from './auth/AuthProvider';
import { ButtonHoverPreviewProvider, useButtonHoverPreview } from './context/ButtonHoverPreviewContext';
import { TutorialDirectorProvider } from './context/TutorialDirectorContext';
import { useAudioScene } from './hooks/useAudioScene';
import { AudioScene } from './services/audioManager';
import { InstallPWABanner } from './components/InstallPWABanner';
import { SWUpdateToast } from './components/SWUpdateToast';

import { SignedInWorkspace } from './components/SignedInWorkspace';
import { CookieConsent } from './components/CookieConsent';
import { AvatarEditorHost } from './components/AvatarEditorHost';

// Not needed for the first paint: the cursor effects, and the town's "we built you a house" pop-up (which brings the
// town's street art). They load just after.
const ButtonHoverCanvas = lazy(() => import('./components/ButtonHoverCanvas').then(m => ({ default: m.ButtonHoverCanvas })));
const MouseTrail = lazy(() => import('./components/MouseTrail').then(m => ({ default: m.MouseTrail })));
const WorldWelcomeMount = lazy(() => import('./features/velvet-world/WorldWelcome').then(m => ({ default: m.WorldWelcomeMount })));

const GAME_PATHS = [
  '/checkers', '/pacman', '/momentum', '/slime-soccer',
  '/stellar-pursuit',
];

const PATH_TO_SCENE: Record<string, AudioScene> = {
  '/lobby':           'lobby',
  '/chat':            'chat',
  '/checkers':        'checkers',
  '/pacman':          'money-grab',
  '/momentum':        'momentum',
  '/slime-soccer':    'slime-soccer',
  '/stellar-pursuit': 'stellar-pursuit',
};

function resolveScene(pathname: string): AudioScene {
  for (const [prefix, scene] of Object.entries(PATH_TO_SCENE)) {
    if (pathname.startsWith(prefix)) return scene;
  }
  if (pathname === '/' || pathname === '') return 'lobby';
  return 'none';
}

function AudioSceneSync() {
  const location = useLocation();
  const { playScene } = useAudioScene();

  useEffect(() => {
    const scene = resolveScene(location.pathname);
    playScene(scene);
  }, [location.pathname, playScene]);

  return null;
}

/**
 * A new page starts at the top. Without this the next page opens at whatever scroll the last one
 * had (tapping "Create an account" low on the home page dropped people at the password field).
 * Back and forward keep where they were, and a link to a part of a page (#section) is left alone.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if (type === 'POP' || hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash, type]);
  return null;
}

const isTouchOnly = () => window.matchMedia('(pointer: coarse)').matches;

function GlobalEffects() {
  const { user } = useAuth();
  const { customization, activeCursorColor, activePointerDef } = useCustomization();
  const { previewStyle } = useButtonHoverPreview();
  const location = useLocation();

  const isGame = GAME_PATHS.some(p => location.pathname.startsWith(p));
  const touchOnly = isTouchOnly();

  // Keep components mounted even when !user to avoid remount flicker;
  // disable effects by passing safe defaults when inactive.
  const active = !!user && !isGame;

  // Phones and tablets get no cursor or touch effects: they look worse on a touch screen, and a
  // full-screen canvas is one more thing between a finger and the page.
  if (touchOnly) return null;

  return (
    <Suspense fallback={null}>
      <ButtonHoverCanvas
        hoverStyle={active ? (customization?.button_hover_style ?? 'none') : 'none'}
        particleColors={activeCursorColor.particles}
        previewStyle={previewStyle}
      />
      <MouseTrail
        pointerSymbol={active ? activePointerDef?.svg : undefined}
        showTrail={active ? (customization?.show_trail ?? false) : false}
        trailStyle={customization?.trail_style ?? 'solid'}
        animationStyle={active ? (customization?.animation_style ?? 'stars') : 'none'}
        trailColor={activeCursorColor?.primary}
        particleColors={activeCursorColor?.particles}
      />
    </Suspense>
  );
}

export function Router() {
  return (
    <BrowserRouter>
      <ButtonHoverPreviewProvider>
          <TutorialDirectorProvider>
            <ToastContainer />
            <FirstPostWatcher />
            <GoalNotesWatcher />
            <Suspense fallback={null}><WorldWelcomeMount /></Suspense>
            <SWUpdateToast />
            <InstallPWABanner />
            <ScrollToTop />
            <AudioSceneSync />
            <GlobalEffects />
            <AvatarEditorHost />
            <CookieConsent />
<SignedInWorkspace>
              <Routes>
                {publicRoutes}
                {onboardingRoutes}
                {appRoutes}
                {adminRoutes}
                {gamesRoutes}
                <Route path="/" element={<RootRedirect />} />
              </Routes>
            </SignedInWorkspace>
          </TutorialDirectorProvider>
      </ButtonHoverPreviewProvider>
    </BrowserRouter>
  );
}
