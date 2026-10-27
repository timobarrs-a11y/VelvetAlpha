import React, { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RequireProfile } from '../components/auth/RequireProfile';
import { RouteFallback } from '../shared/ui/RouteFallback';
import { ReportActivity } from '../features/objectives/ReportActivity';
import type { ReportedKey } from '../services/dailyObjectivesService';

const CheckersGame = lazy(() => import('../pages/CheckersGame').then(m => ({ default: m.CheckersGame })));
const PacmanGame = lazy(() => import('../pages/PacmanGame').then(m => ({ default: m.PacmanGame })));
const MomentumGame = lazy(() => import('../pages/MomentumGame').then(m => ({ default: m.MomentumGame })));
const SlimeSoccer = lazy(() => import('../components/slime-soccer'));
const StellarPursuitGame = lazy(() => import('../pages/StellarPursuitGame').then(m => ({ default: m.StellarPursuitGame })));
const SocialCombatRPGGame = lazy(() => import('../pages/SocialCombatRPGGame').then(m => ({ default: m.SocialCombatRPGGame })));
const ShootoutGame = lazy(() => import('../pages/ShootoutGame').then(m => ({ default: m.ShootoutGame })));
const VelvetHouseGame = lazy(() => import('../pages/VelvetHouseGame').then(m => ({ default: m.VelvetHouseGame })));
const VelvetHouseNextGame = lazy(() => import('../pages/VelvetHouseNextGame').then(m => ({ default: m.VelvetHouseNextGame })));

/** `which`: the game's own objective (every game also counts as "play a game"). */
function game(el: React.ReactNode, which?: ReportedKey) {
  return (
    <ProtectedRoute>
      <RequireProfile>
        <ReportActivity activity={which ? ['play_game', which] : 'play_game'} />
        <Suspense fallback={<RouteFallback />}>{el}</Suspense>
      </RequireProfile>
    </ProtectedRoute>
  );
}

export const gamesRoutes = [
  <Route key="checkers" path="/checkers" element={game(<CheckersGame />, 'play_checkers')} />,
  <Route key="pacman" path="/pacman" element={game(<PacmanGame />, 'play_pacman')} />,
  <Route key="momentum" path="/momentum" element={game(<MomentumGame />, 'play_momentum')} />,
  <Route key="slime-soccer" path="/slime-soccer" element={game(<SlimeSoccer />, 'play_slime_soccer')} />,
  <Route key="stellar-pursuit" path="/stellar-pursuit" element={game(<StellarPursuitGame />, 'play_stellar')} />,
  <Route key="shootout" path="/shootout" element={game(<ShootoutGame />, 'play_shootout')} />,
  <Route key="social-combat" path="/social-combat" element={game(<SocialCombatRPGGame />, 'play_social_combat')} />,
  // Phase 1B: the live game now loads the typed/bundled engine (velvet-house-next entry)
  <Route key="velvet-house" path="/velvet-house" element={game(<VelvetHouseNextGame />, 'play_velvet_sims')} />,
  <Route key="velvet-house-next" path="/velvet-house-next" element={game(<VelvetHouseNextGame />, 'play_velvet_sims')} />,
  // Legacy route kept for any existing bookmarks — redirects to the typed game
  <Route key="velvet-house-legacy" path="/velvet-house-legacy" element={game(<VelvetHouseGame />, 'play_velvet_sims')} />,
];
