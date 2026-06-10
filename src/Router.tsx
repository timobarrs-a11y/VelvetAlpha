import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ToastContainer } from './shared/ui/Toast';
import { RootRedirect } from './routes/rootRedirect';
import { publicRoutes } from './routes/publicRoutes';
import { onboardingRoutes } from './routes/onboardingRoutes';
import { appRoutes } from './routes/appRoutes';
import { adminRoutes } from './routes/adminRoutes';
import { gamesRoutes } from './routes/gamesRoutes';
import { useCustomization } from './hooks/useCustomization';
import { ButtonHoverCanvas } from './components/ButtonHoverCanvas';
import { MouseTrail } from './components/MouseTrail';
import { TouchRippleCanvas } from './components/TouchRippleCanvas';
import { useAuth } from './auth/AuthProvider';
import { ButtonHoverPreviewProvider, useButtonHoverPreview } from './context/ButtonHoverPreviewContext';
import { NavigationLoadingProvider } from './context/NavigationLoadingContext';
import { TutorialDirectorProvider } from './context/TutorialDirectorContext';
import { useAudioScene } from './hooks/useAudioScene';
import { AudioScene } from './services/audioManager';
import { InstallPWABanner } from './components/InstallPWABanner';
import { SWUpdateToast } from './components/SWUpdateToast';

const GAME_PATHS = [
  '/checkers', '/pacman', '/momentum', '/slime-soccer',
  '/stellar-pursuit', '/fox-runner', '/home-run-derby', '/zelda-ocean',
];

const PATH_TO_SCENE: Record<string, AudioScene> = {
  '/lobby':           'lobby',
  '/chat':            'chat',
  '/checkers':        'checkers',
  '/pacman':          'money-grab',
  '/momentum':        'momentum',
  '/slime-soccer':    'slime-soccer',
  '/stellar-pursuit': 'stellar-pursuit',
  '/fox-runner':      'fox-runner',
  '/home-run-derby':  'home-run-derby',
  '/zelda-ocean':     'zelda-ocean',
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

const isTouchOnly = () => window.matchMedia('(pointer: coarse)').matches;

function GlobalEffects() {
  const { user } = useAuth();
  const { customization, activeCursorColor, activePointerDef } = useCustomization();
  const { previewStyle } = useButtonHoverPreview();
  const location = useLocation();

  const isGame = GAME_PATHS.some(p => location.pathname.startsWith(p));

  if (!user || isGame) return null;

  const hoverStyle = customization?.button_hover_style ?? 'none';
  const touchOnly = isTouchOnly();

  if (touchOnly) {
    return (
      <TouchRippleCanvas
        animationStyle={customization?.animation_style ?? 'stars'}
        particleColors={activeCursorColor?.particles}
      />
    );
  }

  return (
    <>
      <ButtonHoverCanvas
        hoverStyle={hoverStyle}
        particleColors={activeCursorColor.particles}
        previewStyle={previewStyle}
      />
      <MouseTrail
        pointerSymbol={activePointerDef?.svg}
        showTrail={customization?.show_trail ?? false}
        trailStyle={customization?.trail_style ?? 'solid'}
        animationStyle={customization?.animation_style ?? 'stars'}
        trailColor={activeCursorColor?.primary}
        particleColors={activeCursorColor?.particles}
      />
    </>
  );
}

export function Router() {
  return (
    <BrowserRouter>
      <ButtonHoverPreviewProvider>
        <NavigationLoadingProvider>
          <TutorialDirectorProvider>
            <ToastContainer />
            <SWUpdateToast />
            <InstallPWABanner />
            <AudioSceneSync />
            <GlobalEffects />
            <Routes>
              {publicRoutes}
              {onboardingRoutes}
              {appRoutes}
              {adminRoutes}
              {gamesRoutes}
              <Route path="/" element={<RootRedirect />} />
            </Routes>
          </TutorialDirectorProvider>
        </NavigationLoadingProvider>
      </ButtonHoverPreviewProvider>
    </BrowserRouter>
  );
}
