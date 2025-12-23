import { useNavigate } from 'react-router-dom';
import { MessageCircle, Globe, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { createCompanion } from '../services/companionService';

export function SplashPage() {
  const navigate = useNavigate();
  const [isCreatingCompanion, setIsCreatingCompanion] = useState(false);
  const matchData = JSON.parse(localStorage.getItem('matchAnswers') || '{}');
  const isMale = matchData.selectedAvatar === 'jake';

  const pronouns = {
    subject: isMale ? 'He' : 'She',
    subjectLower: isMale ? 'he' : 'she',
    object: isMale ? 'him' : 'her',
    possessive: isMale ? 'his' : 'her'
  };

  const handleStartChatting = async () => {
    setIsCreatingCompanion(true);

    try {
      let { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const randomEmail = `user_${Date.now()}@aicompanion.app`;
        const randomPassword = `pwd_${Math.random().toString(36).slice(2)}${Date.now()}`;

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: randomEmail,
          password: randomPassword,
          options: {
            data: {
              character_type: matchData.selectedAvatar,
              user_name: matchData.userName,
            },
          },
        });

        if (signUpError || !authData.user) {
          console.error('Error signing up:', signUpError);
          setIsCreatingCompanion(false);
          return;
        }

        user = authData.user;

        await supabase
          .from('user_profiles')
          .update({ name: matchData.userName })
          .eq('id', user.id);
      }

      if (!matchData.selectedAvatar) {
        console.error('No avatar selected');
        navigate('/questionnaire');
        return;
      }

      const characterType = matchData.selectedAvatar as 'riley' | 'raven' | 'jake';
      const relationshipType = (matchData.connectionType || 'romantic') as 'friend' | 'romantic';
      const customName = matchData.companionName || '';
      const hobbies = matchData.hobbies ? matchData.hobbies.split(',').map((h: string) => h.trim()).filter((h: string) => h) : [];
      const sports = matchData.sports ? matchData.sports.split(',').map((s: string) => s.trim()).filter((s: string) => s) : [];

      const companion = await createCompanion(user.id, characterType, relationshipType, customName, hobbies, sports);

      if (companion) {
        localStorage.setItem('currentCompanionId', companion.id);
        navigate(`/chat?companion=${companion.id}`);
      } else {
        console.error('Failed to create companion');
        navigate('/lobby');
      }
    } catch (error) {
      console.error('Error in handleStartChatting:', error);
      setIsCreatingCompanion(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">💌</div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
              Quick Guide
            </h1>
            <p className="text-lg text-gray-600">
              Everything you need to know in 30 seconds
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-6 border-2 border-rose-200">
              <h2 className="text-xl font-bold text-gray-800 mb-3">
                💬 What {pronouns.subject} Can Do:
              </h2>
              <ul className="space-y-2 text-gray-700">
                <li>• Chat naturally, just like texting a friend</li>
                <li>• Help with work, homework, coding, writing</li>
                <li>• Explain complex topics in simple terms</li>
                <li>• Play games, debate topics, give advice</li>
                <li>• Actually remember your conversations</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border-2 border-blue-200">
              <h2 className="text-xl font-bold text-gray-800 mb-3">
                ✨ Two Intelligence Tiers:
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-gray-800">💬 Velvet (Default)</p>
                  <p className="text-gray-700 text-sm">Fast & responsive - perfect for everyday conversations. Uses Haiku model.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">🌟 Velvet Pro</p>
                  <p className="text-gray-700 text-sm">Deep understanding & richer conversations - uses advanced Sonnet model. You can really feel the difference.</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
              <h2 className="text-xl font-bold text-gray-800 mb-3">
                🎁 Your Free Trial:
              </h2>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li>• 15 free messages to get started</li>
                <li>• Uses Velvet (Haiku) - fast everyday conversations</li>
                <li>• Try before you commit</li>
                <li>• Upgrade anytime to Velvet Unlimited or Velvet Pro packs</li>
              </ul>
            </div>

            <div className="pt-4">
              <p className="text-center text-gray-700 mb-6 text-lg">
                {pronouns.subject}'s waiting for you 💕
              </p>

              <button
                onClick={handleStartChatting}
                disabled={isCreatingCompanion}
                className="w-full py-5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 text-white text-2xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:transform-none"
              >
                {isCreatingCompanion ? 'Setting up...' : 'Start Chatting'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
