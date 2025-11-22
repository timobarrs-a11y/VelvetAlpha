import { X, Heart, MessageCircle, Gift, Star, TrendingUp } from 'lucide-react';
import { RelationshipStats } from '../services/relationshipStatsService';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: RelationshipStats | null;
  achievements: string[];
}

export const StatsModal = ({ isOpen, onClose, stats, achievements }: StatsModalProps) => {
  if (!isOpen || !stats) return null;

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Deep Bond':
        return 'from-pink-600 to-rose-600';
      case 'Connected':
        return 'from-pink-500 to-rose-500';
      case 'Getting Close':
        return 'from-pink-400 to-rose-400';
      default:
        return 'from-pink-300 to-rose-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className={`bg-gradient-to-r ${getLevelColor(stats.relationship_level)} p-6 text-white`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-3xl font-bold mb-2">Your Relationship</h2>
          <p className="text-pink-100 text-lg">{stats.relationship_level}</p>
          <p className="text-pink-200 text-sm mt-1">Day {stats.days_together} together</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-pink-50 to-rose-50 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-5 h-5 text-pink-600" />
                <p className="text-sm font-medium text-gray-600">Messages Sent</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.total_messages_sent}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-5 h-5 text-purple-600" />
                <p className="text-sm font-medium text-gray-600">Messages Received</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.total_messages_received}</p>
            </div>

            <div className="bg-gradient-to-br from-rose-50 to-pink-50 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-5 h-5 text-rose-600" />
                <p className="text-sm font-medium text-gray-600">Times Made Smile</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.times_made_smile}</p>
            </div>

            <div className="bg-gradient-to-br from-pink-50 to-rose-50 p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="w-5 h-5 text-pink-600" />
                <p className="text-sm font-medium text-gray-600">Gifts Exchanged</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.gifts_exchanged}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Love Expressed</span>
              <span className="text-lg font-bold text-pink-600">{stats.times_said_love}x</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Vulnerability Moments</span>
              <span className="text-lg font-bold text-purple-600">{stats.vulnerability_moments}x</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Longest Conversation</span>
              <span className="text-lg font-bold text-rose-600">{stats.longest_conversation} messages</span>
            </div>
          </div>

          {achievements.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-bold text-gray-900">Achievements</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {achievements.map((achievement, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-r from-yellow-100 to-amber-100 px-3 py-2 rounded-lg border border-yellow-300"
                  >
                    <p className="text-sm font-medium text-yellow-900">🏆 {achievement}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-pink-600">
              <TrendingUp className="w-4 h-4" />
              <p className="text-sm font-medium">Keep talking to level up your relationship!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};