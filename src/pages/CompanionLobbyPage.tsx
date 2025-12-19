import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, MessageCircle, Heart, Users } from 'lucide-react';
import { supabase } from '../services/supabase';
import { getCompanions, CompanionWithLastMessage } from '../services/companionService';

const characterNames = {
  riley: 'Riley',
  raven: 'Raven',
  jake: 'Jake'
};

const characterImages = {
  riley: '/images/riley-positive.jpg',
  raven: '/images/raven-positive.jpg',
  jake: '/images/jake-positive.jpg'
};

export function CompanionLobbyPage() {
  const navigate = useNavigate();
  const [companions, setCompanions] = useState<CompanionWithLastMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanions();
  }, []);

  const loadCompanions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/');
      return;
    }

    const companionsList = await getCompanions(user.id);
    setCompanions(companionsList);
    setLoading(false);
  };

  const handleCompanionClick = (companionId: string) => {
    navigate(`/chat?companion=${companionId}`);
  };

  const handleNewCompanion = () => {
    navigate('/questionnaire');
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading your companions...</p>
        </div>
      </div>
    );
  }

  if (companions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl p-12"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Ready To Find Your First Companion?
            </h2>
            <p className="text-gray-600 mb-8">
              Answer a few quick questions and we'll match you with the perfect companion.
            </p>
            <button
              onClick={handleNewCompanion}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              Get Started
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2">
            Your Companions
          </h1>
          <p className="text-gray-600 text-lg">
            Choose who you'd like to chat with today
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {companions.map((companion, index) => (
            <motion.div
              key={companion.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleCompanionClick(companion.id)}
              className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:scale-105 overflow-hidden"
            >
              <div className="relative h-48 bg-gradient-to-br from-rose-100 to-pink-100">
                <img
                  src={characterImages[companion.character_type]}
                  alt={characterNames[companion.character_type]}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold shadow-lg ${
                      companion.relationship_type === 'romantic'
                        ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                    }`}
                  >
                    {companion.relationship_type === 'romantic' ? (
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        Partner
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Friend
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  {characterNames[companion.character_type]}
                </h3>

                {companion.last_message_text && (
                  <div className="mb-3">
                    <div className="flex items-start gap-2 text-sm">
                      <MessageCircle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-600 line-clamp-2">
                        {companion.last_message_role === 'assistant' && (
                          <span className="font-semibold">
                            {characterNames[companion.character_type]}:{' '}
                          </span>
                        )}
                        {companion.last_message_text}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                  <span>Last active {formatTimeAgo(companion.last_message_at)}</span>
                  {companion.unread_count !== undefined && companion.unread_count > 0 && (
                    <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full font-semibold">
                      {companion.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: companions.length * 0.1 }}
            onClick={handleNewCompanion}
            className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:scale-105 border-2 border-dashed border-gray-300 hover:border-rose-400 flex items-center justify-center min-h-[320px]"
          >
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Plus className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Find Another Match
              </h3>
              <p className="text-gray-600 text-sm">
                Add a new companion to your collection
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
