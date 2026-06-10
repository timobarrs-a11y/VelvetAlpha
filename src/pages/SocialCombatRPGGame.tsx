import { useNavigate, useSearchParams } from 'react-router-dom';
import SocialCombatRPG from '../components/games/SocialCombatRPG';

export function SocialCombatRPGGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companionId = searchParams.get('companion');

  const handleExit = () => {
    if (companionId) {
      navigate(`/chat?companion=${companionId}`);
    } else {
      navigate('/lobby');
    }
  };

  return <SocialCombatRPG onExit={handleExit} />;
}
