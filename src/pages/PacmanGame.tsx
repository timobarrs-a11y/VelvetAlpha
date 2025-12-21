import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Home } from 'lucide-react';
import { MoneyGrabGameEngine } from '../components/MoneyGrabGameEngine';
import { getCompanion } from '../services/companionService';
import { supabase } from '../services/supabase';

export function PacmanGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [playerName, setPlayerName] = useState<string>('Player');
  const [companionName, setCompanionName] = useState<string>('Companion');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGameData();
  }, []);

  async function loadGameData() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        navigate('/');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      if (profile?.name) {
        setPlayerName(profile.name);
      }

      const companionId = searchParams.get('companion');

      if (!companionId) {
        setError('No companion selected. Please choose a companion from the lobby.');
        setTimeout(() => navigate('/lobby'), 2000);
        return;
      }

      const companion = await getCompanion(companionId);

      if (!companion) {
        setError('Companion not found. Returning to lobby...');
        setTimeout(() => navigate('/lobby'), 2000);
        return;
      }

      const displayName = companion.custom_name ||
                         companion.character_type.charAt(0).toUpperCase() +
                         companion.character_type.slice(1);

      setCompanionName(displayName);

    } catch (err) {
      console.error('Failed to load game data:', err);
      setError('Failed to load game. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGameComplete(finalScore: number, level: number) {
    try {
      const companionId = searchParams.get('companion');
      if (!companionId) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          companion_id: companionId,
          role: 'user',
          content: `Just finished Money Grab! Made it to level ${level} with $${finalScore}! 🎮💰`
        });

      console.log('Game completed!', { finalScore, level });
    } catch (error) {
      console.error('Failed to save game result:', error);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-2xl font-bold text-white">Loading game...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400 mb-4">{error}</div>
          <button
            onClick={() => navigate('/lobby')}
            className="px-6 py-3 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            Go to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              const companionId = searchParams.get('companion');
              navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <Home className="w-5 h-5" />
            <span>Back to Chat</span>
          </button>
        </div>

        <MoneyGrabGameEngine
          playerName={playerName}
          companionName={companionName}
          onGameComplete={handleGameComplete}
        />
      </div>
    </div>
  );
}
