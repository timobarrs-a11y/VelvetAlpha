import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import App from './App';
import { QuestionnairePage } from './pages/QuestionnairePage';
import { AnalyzingPage } from './pages/AnalyzingPage';
import { MatchRevealPage } from './pages/MatchRevealPage';
import { SplashPage } from './pages/SplashPage';
import { CompanionLobbyPage } from './pages/CompanionLobbyPage';
import { CheckersGame } from './pages/CheckersGame';
import { PacmanGame } from './pages/PacmanGame';
import { SuccessPage } from './pages/SuccessPage';
import { supabase } from './services/supabase';
import { getCompanions } from './services/companionService';

function RootRedirect() {
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    async function determineRoute() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setDestination('/questionnaire');
        return;
      }

      const companions = await getCompanions(user.id);

      if (companions.length === 0) {
        setDestination('/questionnaire');
      } else {
        setDestination('/lobby');
      }
    }

    determineRoute();
  }, []);

  if (!destination) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4"></div>
        </div>
      </div>
    );
  }

  return <Navigate to={destination} replace />;
}

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/questionnaire" element={<QuestionnairePage />} />
        <Route path="/analyzing" element={<AnalyzingPage />} />
        <Route path="/match-reveal" element={<MatchRevealPage />} />
        <Route path="/lobby" element={<CompanionLobbyPage />} />
        <Route path="/splash" element={<SplashPage />} />
        <Route path="/chat" element={<App />} />
        <Route path="/checkers" element={<CheckersGame />} />
        <Route path="/pacman" element={<PacmanGame />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
