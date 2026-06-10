import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../shared/supabase/client';
import { SIGNATURE_VOICES, canUseVoice, SignatureVoice, getVoicesByCategory } from '../config/signatureVoices';
import SignatureVoiceTile from '../components/SignatureVoiceTile';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function SignatureVoiceSelectionPage() {
  const navigate = useNavigate();
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companionGender, setCompanionGender] = useState<'male' | 'female'>('female');
  const [availableVoices, setAvailableVoices] = useState<SignatureVoice[]>([]);
  const isTestingMode = import.meta.env.DEV && import.meta.env.VITE_TESTING_MODE === 'true';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const matchData = JSON.parse(sessionStorage.getItem('matchAnswers') || '{}');
    const gender = matchData.relationshipType === 'Male' ? 'male' : 'female';
    setCompanionGender(gender);

    const filtered = SIGNATURE_VOICES.filter(voice =>
      voice.gender === gender || voice.gender === 'neutral'
    );
    setAvailableVoices(filtered);

    await checkPremiumStatus();
  };

  const checkPremiumStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .maybeSingle();

    const tier = profile?.subscription_tier;
    setIsPremium(tier === 'trial' || tier === 'unlimited' || tier === 'starter' || tier === 'plus' || tier === 'elite');
  };

  const handleVoiceClick = (voiceId: string) => {
    setSelectedVoice(voiceId);
  };

  const handleContinueFree = async () => {
    const defaultVoice = companionGender === 'male' ? 'classic_male' : 'classic_female';
    await saveVoiceAndContinue(defaultVoice);
  };

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  const handleContinueWithSelected = async () => {
    if (!selectedVoice) return;
    await saveVoiceAndContinue(selectedVoice);
  };

  const saveVoiceAndContinue = async (voiceId: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const companionId = sessionStorage.getItem('currentCompanionId');

      if (user && companionId) {
        console.log('[VoiceSelection] Updating companion with voice:', voiceId);
        const { error } = await supabase
          .from('companions')
          .update({ signature_voice: voiceId })
          .eq('id', companionId);

        if (error) {
          console.error('[VoiceSelection] Error updating companion:', error);
        }
      } else {
        console.warn('[VoiceSelection] Missing user or companion ID, continuing anyway');
      }
    } catch (error) {
      console.error('Error saving voice:', error);
    } finally {
      setLoading(false);
      navigate('/create-companion-avatar', { replace: true });
    }
  };

  const canProceedWithSelected = !!selectedVoice;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-rose-900 text-white overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-rose-500 mb-6">
            <Sparkles className="w-8 h-8" />
          </div>

          <h1 className="text-4xl font-bold mb-4">
            You've given them personality, now give them a voice.
          </h1>

          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Signature voice changes how they talk—their slang, their whole vibe. Same personality, different delivery.
          </p>
        </div>

        {isTestingMode && (
          <div className="bg-yellow-900/30 border border-yellow-500 rounded-xl p-4 mb-6 text-center">
            <p className="text-yellow-300 font-semibold">
              Testing Mode Active - All Premium Voices Unlocked
            </p>
          </div>
        )}

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8 text-center">
          {!isTestingMode && (
            <>
              <h2 className="text-xl font-bold mb-2">
                Most Signature Voices are premium.
              </h2>

              <p className="text-gray-300 text-sm mb-4">
                You have {availableVoices.filter(v => !v.premium).length} free voices available, or upgrade to unlock all {availableVoices.length} signature voices for your {companionGender} companion.
              </p>
            </>
          )}

          {isTestingMode && (
            <>
              <h2 className="text-xl font-bold mb-2">
                Select Your Voice
              </h2>

              <p className="text-gray-300 text-sm mb-4">
                Testing mode enabled - all voices are available for testing.
              </p>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {selectedVoice ? (
              <button
                onClick={handleContinueWithSelected}
                disabled={loading}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg font-semibold transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Continue with Selected Voice'}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 rounded-lg font-semibold transition-all text-sm"
                >
                  Upgrade to Premium
                </button>

                <button
                  onClick={handleContinueFree}
                  disabled={loading}
                  className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-all text-sm"
                >
                  Continue Free
                </button>
              </>
            )}
          </div>

          {!isPremium && !isTestingMode && (
            <p className="mt-3 text-xs text-gray-400">
              You can always upgrade later in settings to unlock all premium voices.
            </p>
          )}
        </div>

        <div className="space-y-8 mb-12">
          {getVoicesByCategory(companionGender, 'standard').length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-200">Standard Voices</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getVoicesByCategory(companionGender, 'standard').map((voice) => (
                  <SignatureVoiceTile
                    key={voice.id}
                    voice={voice}
                    selected={selectedVoice === voice.id}
                    onClick={() => handleVoiceClick(voice.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {getVoicesByCategory(companionGender, 'anime').length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-2 text-gray-200">Anime-Inspired Voices</h2>
              <p className="text-gray-400 mb-4 text-sm">
                Character archetypes from anime and manga culture
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getVoicesByCategory(companionGender, 'anime').map((voice) => (
                  <SignatureVoiceTile
                    key={voice.id}
                    voice={voice}
                    selected={selectedVoice === voice.id}
                    onClick={() => handleVoiceClick(voice.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {getVoicesByCategory(companionGender, 'culture').length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-2 text-gray-200">Cultural Voices</h2>
              <p className="text-gray-400 mb-4 text-sm">
                Distinct cultural and regional communication styles
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getVoicesByCategory(companionGender, 'culture').map((voice) => (
                  <SignatureVoiceTile
                    key={voice.id}
                    voice={voice}
                    selected={selectedVoice === voice.id}
                    onClick={() => handleVoiceClick(voice.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
