import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../shared/supabase/client';
import { SIGNATURE_VOICES, SignatureVoice, getVoicesByCategory } from '../config/signatureVoices';
import { createCompanion } from '../services/companionService';
import { seedVoiceBaseline } from '../services/voiceFidelityService';
import SignatureVoiceTile from '../components/SignatureVoiceTile';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function SignatureVoiceSelectionPage() {
  const navigate = useNavigate();
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [companionGender, setCompanionGender] = useState<'male' | 'female'>('female');
  const [availableVoices, setAvailableVoices] = useState<SignatureVoice[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const matchData = JSON.parse(sessionStorage.getItem('matchAnswers') || '{}');
    const expertData = JSON.parse(sessionStorage.getItem('expertMatchAnswers') || '{}');
    const genderRaw = matchData.relationshipType || expertData.gender || 'Female';
    const gender = genderRaw === 'Male' ? 'male' : 'female';
    setCompanionGender(gender);

    const filtered = SIGNATURE_VOICES.filter(voice =>
      voice.gender === gender || voice.gender === 'neutral'
    );
    setAvailableVoices(filtered);
  };

  const handleVoiceClick = (voiceId: string) => {
    setSelectedVoice(voiceId);
  };

  // Skipping keeps the plain classic voice for their gender; "surprise me" picks any of them.
  const handleSkip = async () => {
    await saveVoiceAndContinue(companionGender === 'male' ? 'classic_male' : 'classic_female');
  };

  const handleSurprise = async () => {
    const pick = availableVoices[Math.floor(Math.random() * availableVoices.length)];
    if (pick) await saveVoiceAndContinue(pick.id);
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
      const onboardingIntent = sessionStorage.getItem('onboardingIntent');

      if (user && companionId) {
        const { error } = await supabase
          .from('companions')
          .update({ signature_voice: voiceId })
          .eq('id', companionId);

        if (error) {
          console.error('[VoiceSelection] Error updating companion:', error);
        } else {
          await seedVoiceBaseline(companionId, voiceId, companionGender).catch(err =>
            console.error('[VoiceSelection] Failed to seed voice baseline:', err)
          );
        }
      } else if (user && onboardingIntent === 'coaches') {
        const { data: existingMentor } = await supabase
          .from('companions')
          .select('id, custom_name')
          .eq('user_id', user.id)
          .eq('relationship_type', 'mentor')
          .eq('is_active', true)
          .maybeSingle();

        if (existingMentor) {
          sessionStorage.setItem('currentCompanionId', existingMentor.id);
          await supabase
            .from('companions')
            .update({ signature_voice: voiceId })
            .eq('id', existingMentor.id);
          await seedVoiceBaseline(existingMentor.id, voiceId, companionGender).catch(err =>
            console.error('[VoiceSelection] Failed to seed voice baseline:', err)
          );
        } else {
          const expertData = JSON.parse(sessionStorage.getItem('expertMatchAnswers') || '{}');
          const expertId = sessionStorage.getItem('selectedExpertId');
          const expertSource = sessionStorage.getItem('selectedExpertSource') as 'curated' | 'user' | null;

          const gender: 'male' | 'female' = expertData.gender === 'Male' ? 'male' : 'female';
          const customName = expertData.customName || 'Mentor';

          const companion = await createCompanion({
            userId: user.id,
            gender,
            relationshipType: 'mentor',
            customName,
            hobbies: [],
            signatureVoice: voiceId,
            signatureExpert: expertId || undefined,
            signatureExpertSource: expertSource || undefined,
            energyPreference: expertData.energyPreference,
            communicationStyle: expertData.communicationStyle,
            supportStyle: expertData.supportStyle,
            conversationDepth: expertData.conversationDepth,
          });

          if (companion) {
            sessionStorage.setItem('currentCompanionId', companion.id);

            const matchData = {
              userName: '',
              userGender: '',
              relationshipType: expertData.gender || 'Female',
              connectionType: 'mentor',
              companionName: customName,
              energyPreference: expertData.energyPreference,
              communicationStyle: expertData.communicationStyle,
              supportStyle: expertData.supportStyle,
              conversationDepth: expertData.conversationDepth,
            };
            sessionStorage.setItem('matchAnswers', JSON.stringify(matchData));
          }
        }
      }
    } catch (error) {
      console.error('Error saving voice:', error);
    } finally {
      setLoading(false);
      navigate('/create-companion-avatar', { replace: true });
    }
  };

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

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8 text-center">
          <h2 className="text-xl font-bold mb-2">
            Pick a signature voice
          </h2>

          <p className="text-gray-300 text-sm mb-4">
            All {availableVoices.length} voices for your {companionGender} companion are open to you. Tap one to hear how they'd sound.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleContinueWithSelected}
              disabled={loading || !selectedVoice}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-lg font-semibold transition-all inline-flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {loading ? 'Saving...' : selectedVoice ? 'Continue with this voice' : 'Choose a voice to continue'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleSurprise}
              disabled={loading}
              className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-all text-sm disabled:opacity-40"
            >
              Surprise me
            </button>
          </div>

          <button
            onClick={handleSkip}
            disabled={loading}
            className="mt-3 text-xs text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-40"
          >
            Skip, use the classic voice
          </button>
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
