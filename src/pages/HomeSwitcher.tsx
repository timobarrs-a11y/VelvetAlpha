import { lazy, Suspense } from 'react';
import { useHomeLayout } from '../hooks/useHomeLayout';
import { RouteFallback } from '../shared/ui/RouteFallback';

const CompanionLobbyPage = lazy(() => import('./CompanionLobbyPage').then(m => ({ default: m.CompanionLobbyPage })));
const HomeShellPage = lazy(() => import('./HomeShellPage').then(m => ({ default: m.HomeShellPage })));
const HomeV3Page = lazy(() => import('./HomeV3Page').then(m => ({ default: m.HomeV3Page })));

export function HomeSwitcher() {
  const [layout] = useHomeLayout();

  return (
    <Suspense fallback={<RouteFallback />}>
      {layout === 'v3' ? <HomeV3Page /> : layout === 'new' ? <HomeShellPage /> : <CompanionLobbyPage />}
    </Suspense>
  );
}
