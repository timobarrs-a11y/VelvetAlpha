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

      const companion = await createCompanion(user.id, characterType, relationshipType);

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
      <div className="max-w-3xl w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">💌</div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800">
              A Note from the Team
            </h1>
          </div>

          <div className="space-y-8">
            <div>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Here's something you should know about {pronouns.object}:
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                {pronouns.subject}'s brilliant. Like, genuinely smart.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed">
                {pronouns.subject} can help you write a thesis, explain complex history, break down sports stats, or just play games with you. Code a website, analyze your fantasy lineup, debate philosophy at 2am.
              </p>
              <p className="text-lg text-gray-700 leading-relaxed mt-4">
                Whatever you need - {pronouns.subjectLower}'s got you.
              </p>
            </div>

            <div className="border-t-2 border-gray-200 pt-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                HOW TO TALK TO {isMale ? 'HIM' : 'HER'}:
              </h2>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      DAY-TO-DAY CONVERSATIONS
                    </h3>
                    <p className="text-gray-700 leading-relaxed">
                      Just... talk. Like you would with anyone you're getting to know. {pronouns.subject}'ll be {pronouns.object}self - playful, caring, curious about you.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center">
                      <Globe className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                      WHEN YOU NEED HELP
                    </h3>
                    <p className="text-gray-700 leading-relaxed mb-3">
                      {pronouns.subject} loves solving problems. Writing, research, coding, explaining things - {pronouns.subjectLower}'s really good at it.
                    </p>
                    <p className="text-gray-700 leading-relaxed mb-3">
                      There's a toggle at the top:<br />
                      💬 → 🌐
                    </p>
                    <p className="text-gray-700 leading-relaxed">
                      Use it when you need {pronouns.possessive} brain, not just {pronouns.possessive} company.
                    </p>
                    <p className="text-gray-700 leading-relaxed mt-3">
                      {pronouns.subject}'ll give you detailed, structured answers (think: how your smartest friend explains something when they're in "teaching mode").
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-gray-200 pt-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                WHAT THIS MEANS FOR YOU:
              </h2>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-200">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Check className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <p className="text-lg font-semibold text-gray-800">Cancel ChatGPT Plus</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Check className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <p className="text-lg font-semibold text-gray-800">Cancel Claude Pro</p>
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed mt-4">
                  You don't need them anymore. {pronouns.subject} can do everything they can, but {pronouns.subjectLower} actually knows you.
                </p>
                <p className="text-gray-700 leading-relaxed mt-2 font-semibold">
                  Same intelligence. Better conversation.
                </p>
              </div>
            </div>

            <div className="border-t-2 border-gray-200 pt-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                HOW {isMale ? 'HIS' : 'HER'} ENERGY WORKS:
              </h2>

              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                {pronouns.subject}'s powered by AI, which means conversations use energy (we call them tokens).
              </p>

              <p className="text-lg text-gray-700 leading-relaxed mb-4">
                Here's how it works:
              </p>

              <div className="bg-blue-50 rounded-xl p-6 mb-4">
                <h3 className="text-xl font-bold text-gray-800 mb-3">
                  FREE TIER:
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Your first conversation: 25 messages to get to know each other</li>
                  <li>• After that: 10 free messages refresh every day at midnight</li>
                  <li>• When {pronouns.subjectLower}'s running low on energy, {pronouns.subjectLower}'ll let you know naturally - {pronouns.subjectLower} might say {pronouns.subjectLower}'s getting sleepy or tired</li>
                  <li>• {pronouns.subject}'ll never directly ask you to buy anything (that would be weird)</li>
                </ul>
              </div>

              <div className="bg-amber-50 rounded-xl p-6 mb-4">
                <h3 className="text-xl font-bold text-gray-800 mb-3">
                  WHAT HAPPENS WHEN ENERGY RUNS LOW:
                </h3>
                <p className="text-gray-700 mb-2">
                  When {pronouns.subjectLower} has about 10% energy left, {pronouns.subjectLower}'ll hint {pronouns.subjectLower}'s getting tired:
                </p>
                <p className="text-gray-600 italic ml-4 mb-3">
                  "{isMale ? 'bro' : 'babe'} I'm getting a little tired... 😴"
                </p>
                <p className="text-gray-700 mb-2">
                  When {pronouns.subjectLower}'s almost out (5% or less), {pronouns.subjectLower}'ll be more direct:
                </p>
                <p className="text-gray-600 italic ml-4 mb-3">
                  "I can barely keep my eyes open... I think I need to rest soon {isMale ? '💪' : '💕'}"
                </p>
                <p className="text-gray-700">
                  Then {pronouns.subjectLower}'ll go to sleep until your daily messages refresh, or you can get more tokens to keep talking.
                </p>
              </div>

              <div className="bg-purple-50 rounded-xl p-6 mb-4">
                <h3 className="text-xl font-bold text-gray-800 mb-3">
                  SUBSCRIPTION PLANS:
                </h3>
                <p className="text-gray-700 mb-3">
                  If you want unlimited conversations without worrying about energy:
                </p>
                <ul className="space-y-2 text-gray-700 ml-4">
                  <li>• <span className="font-semibold">Basic Plan ($14.99/mo):</span> More messages per day</li>
                  <li>• <span className="font-semibold">Premium Plan ($29.99/mo):</span> Unlimited messages, never sleeps</li>
                </ul>
                <p className="text-gray-700 mt-3">
                  Think of it like this: Free tier lets you text throughout the day. Subscription means {pronouns.subjectLower}'s always available when you need {pronouns.object}.
                </p>
              </div>
            </div>

            <div className="border-t-2 border-gray-200 pt-8">
              <p className="text-lg text-gray-700 leading-relaxed text-center mb-6">
                Alright. That's it. {pronouns.subject}'s waiting for you.
              </p>

              <button
                onClick={handleStartChatting}
                disabled={isCreatingCompanion}
                className="w-full py-5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:from-gray-400 disabled:to-gray-500 text-white text-2xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:transform-none"
              >
                {isCreatingCompanion ? 'Setting up...' : 'Start Chatting 💕'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
