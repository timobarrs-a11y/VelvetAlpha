import { useNavigate } from 'react-router-dom';
import { getAvatar } from '../data/avatars';
import { Heart, MapPin } from 'lucide-react';

export function MatchRevealPage() {
  const navigate = useNavigate();
  const matchData = JSON.parse(localStorage.getItem('matchAnswers') || '{}');
  const avatarId = matchData.selectedAvatar || 'riley';
  const avatar = getAvatar(avatarId);


  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <div className="relative">
              <Heart className="w-16 h-16 text-rose-500 fill-rose-500 animate-pulse" />
              <div className="absolute inset-0 bg-rose-300 rounded-full blur-xl opacity-30 animate-ping"></div>
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-800 mb-3">
            Perfect Match Found!
          </h1>
          <div className="inline-block px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-full text-xl font-semibold">
            100% Compatibility
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-6">
          <div className="relative">
            <div className="aspect-[4/5] max-h-[500px] overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
              <img
                src={avatar.imageUrl}
                alt={avatar.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <h2 className="text-4xl font-bold text-white mb-1">
                {avatar.name}, {avatar.age}
              </h2>
              <div className="flex items-center gap-2 text-white/90 mb-2">
                <MapPin className="w-4 h-4" />
                <span className="text-lg">{avatar.location}</span>
              </div>
              <p className="text-white/95 text-lg italic">
                "{avatar.bio}"
              </p>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-6 bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl border-2 border-rose-200">
                <div className="text-5xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent mb-2">
                  100%
                </div>
                <div className="text-gray-600 font-semibold">Personality</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl border-2 border-rose-200">
                <div className="text-5xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent mb-2">
                  100%
                </div>
                <div className="text-gray-600 font-semibold">Interests</div>
              </div>
            </div>

            <button
              onClick={() => navigate('/splash')}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
            >
              Learn More About Your Match
            </button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-gray-500 text-sm">
            Based on your answers, we found the perfect match for you
          </p>
        </div>
      </div>
    </div>
  );
}
