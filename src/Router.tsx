import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { QuestionnairePage } from './pages/QuestionnairePage';
import { AnalyzingPage } from './pages/AnalyzingPage';
import { MatchRevealPage } from './pages/MatchRevealPage';
import { SplashPage } from './pages/SplashPage';

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/questionnaire" element={<QuestionnairePage />} />
        <Route path="/analyzing" element={<AnalyzingPage />} />
        <Route path="/match-reveal" element={<MatchRevealPage />} />
        <Route path="/splash" element={<SplashPage />} />
        <Route path="/chat" element={<App />} />
        <Route path="/" element={<Navigate to="/questionnaire" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
