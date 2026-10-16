import { lazy, Suspense } from 'react';
import { useHomeLayout } from '../hooks/useHomeLayout';
import { RouteFallback } from '../shared/ui/RouteFallback';

const CompanionLobbyPage = lazy(() => import('./CompanionLobbyPage').then(m => ({ default: m.CompanionLobbyPage })));
const HomeV3Page = lazy(() => import('./HomeV3Page').then(m => ({ default: m.HomeV3Page })));

export function HomeSwitcher() {
  const [layout] = useHomeLayout();

  return (
    <Suspense fallback={<RouteFallback />}>
      {layout === 'v3' ? <HomeV3Page /> : <CompanionLobbyPage />}
    </Suspense>
  );
}
