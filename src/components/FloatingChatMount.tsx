import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { FloatingChat } from './FloatingChat';

const GAME_PATHS = [
  '/checkers', '/pacman', '/momentum', '/slime-soccer',
  '/stellar-pursuit',
];

const HIDDEN_PATHS = [
  '/splash', '/signin', '/signup', '/onboarding',
];

export function FloatingChatMount() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;
  if (GAME_PATHS.some(p => location.pathname.startsWith(p))) return null;
  if (HIDDEN_PATHS.some(p => location.pathname.startsWith(p))) return null;
  if (location.pathname.startsWith('/chat')) return null;

  return <FloatingChat />;
}
