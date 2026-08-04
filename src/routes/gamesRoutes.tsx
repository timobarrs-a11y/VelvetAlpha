import React, { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RouteFallback } from '../shared/ui/RouteFallback';

const CheckersGame = lazy(() => import('../pages/CheckersGame').then(m => ({ default: m.CheckersGame })));
const PacmanGame = lazy(() => import('../pages/PacmanGame').then(m => ({ default: m.PacmanGame })));
const MomentumGame = lazy(() => import('../pages/MomentumGame').then(m => ({ default: m.MomentumGame })));
const SlimeSoccer = lazy(() => import('../components/slime-soccer'));
const StellarPursuitGame = lazy(() => import('../pages/StellarPursuitGame').then(m => ({ default: m.StellarPursuitGame })));
const SocialCombatRPGGame = lazy(() => import('../pages/SocialCombatRPGGame').then(m => ({ default: m.SocialCombatRPGGame })));

function game(el: React.ReactNode) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<RouteFallback />}>{el}</Suspense>
    </ProtectedRoute>
  );
}

export const gamesRoutes = [
  <Route key="checkers" path="/checkers" element={game(<CheckersGame />)} />,
  <Route key="pacman" path="/pacman" element={game(<PacmanGame />)} />,
  <Route key="momentum" path="/momentum" element={game(<MomentumGame />)} />,
  <Route key="slime-soccer" path="/slime-soccer" element={game(<SlimeSoccer />)} />,
  <Route key="stellar-pursuit" path="/stellar-pursuit" element={game(<StellarPursuitGame />)} />,
  <Route key="social-combat" path="/social-combat" element={game(<SocialCombatRPGGame />)} />,
];
