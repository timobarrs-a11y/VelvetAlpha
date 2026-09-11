import { lazy, Suspense } from 'react';
import { useHomeLayout } from '../hooks/useHomeLayout';
import { RouteFallback } from '../shared/ui/RouteFallback';

const CompanionLobbyPage = lazy(() => import('./CompanionLobbyPage').then(m => ({ default: m.CompanionLobbyPage })));
const HomeShellPage = lazy(() => import('./HomeShellPage').then(m => ({ default: m.HomeShellPage })));

export function HomeSwitcher() {
  const [layout] = useHomeLayout();

  return (
    <Suspense fallback={<RouteFallback />}>
      {layout === 'new' ? <HomeShellPage /> : <CompanionLobbyPage />}
    </Suspense>
  );
}
