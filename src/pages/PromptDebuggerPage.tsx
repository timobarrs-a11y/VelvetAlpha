import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { getCompanions, type Companion } from '../services/companionService';
import { buildSystemPrompt } from '../config/systemPromptBuilder';

export function PromptDebuggerPage() {
  const navigate = useNavigate();
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [selectedCompanion, setSelectedCompanion] = useState<Companion | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      setUserProfile(profile);

      const companionsList = await getCompanions(user.id);
      setCompanions(companionsList);

      if (companionsList.length > 0) {
        setSelectedCompanion(companionsList[0]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCompanion && userProfile) {
      generatePrompt();
    }
  }, [selectedCompanion, userProfile]);

  const generatePrompt = () => {
    if (!selectedCompanion || !userProfile) return;

    const matchData = JSON.parse(localStorage.getItem('matchAnswers') || '{}');
    const userGender = matchData.userGender || userProfile.gender;
    const connectionType = selectedCompanion.relationship_type;

    const prompt = buildSystemPrompt({
      companionName: selectedCompanion.custom_name,
      companionGender: selectedCompanion.gender,
      userName: userProfile.name,
      userGender,
      userAge: userProfile.birthday ? calculateAge(userProfile.birthday) : undefined,
      userBirthday: userProfile.birthday,
      interests: userProfile.interests || [],
      hobbies: selectedCompanion.hobbies || [],
      sports: selectedCompanion.sports || [],
      relationshipType: connectionType,
      favoriteColor: selectedCompanion.favorite_color,
      musicGenre: selectedCompanion.music_genre,
      newsTopics: selectedCompanion.news_categories,
      signatureVoice: selectedCompanion.signature_voice || 'classic_female',
      relationshipDuration: Math.floor((Date.now() - new Date(selectedCompanion.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      questionnaireData: {
        interestText: selectedCompanion.interest_text,
        loveLanguage: selectedCompanion.love_language,
        supportStyle: selectedCompanion.support_style,
        lifeContext: selectedCompanion.life_context,
        energyPreference: selectedCompanion.energy_preference,
        dynamicPreference: selectedCompanion.dynamic_preference,
        confrontationStyle: selectedCompanion.confrontation_style,
        availabilityLevel: selectedCompanion.availability_level,
        flirtingStyle: selectedCompanion.flirting_style,
        humorStyle: selectedCompanion.humor_style,
        communicationStyle: selectedCompanion.communication_style,
        emotionalOpenness: selectedCompanion.emotional_openness,
        conversationDepth: selectedCompanion.conversation_depth,
        expressiveness: selectedCompanion.expressiveness,
        initiative: selectedCompanion.initiative,
      },
    });

    setGeneratedPrompt(prompt);
  };

  const calculateAge = (birthday: string): number => {
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/lobby')}
          className="mb-6 flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back to Lobby</span>
        </button>

        <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
            <h1 className="text-3xl font-bold text-white">System Prompt Debugger</h1>
            <p className="text-blue-100 mt-2">View and test your companion's generated system prompt</p>
          </div>

          <div className="p-8">
            {companions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No companions found. Create one first!</p>
                <button
                  onClick={() => navigate('/')}
                  className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Create Companion
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Select Companion
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {companions.map((companion) => (
                      <button
                        key={companion.id}
                        onClick={() => setSelectedCompanion(companion)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedCompanion?.id === companion.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                        }`}
                      >
                        <div className="font-semibold text-white">{companion.custom_name}</div>
                        <div className="text-sm text-gray-400 mt-1">
                          {companion.gender === 'male' ? 'Male' : 'Female'} • {companion.relationship_type}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Voice: {companion.signature_voice || 'default'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedCompanion && (
                  <>
                    <div className="border-t border-slate-700 pt-6">
                      <h2 className="text-xl font-semibold text-white mb-4">Your Profile (User Data)</h2>
                      <div className="bg-slate-900/50 rounded-lg p-6 space-y-3">
                        <DataRow label="Your Name" value={userProfile.name} />
                        <DataRow label="Your Gender" value={userProfile.gender} />
                        <DataRow
                          label="Your Birthday"
                          value={userProfile.birthday ? `${userProfile.birthday} (Age: ${calculateAge(userProfile.birthday)})` : undefined}
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-700 pt-6 mt-6">
                      <h2 className="text-xl font-semibold text-white mb-4">Companion Data</h2>
                      <div className="bg-slate-900/50 rounded-lg p-6 space-y-3">
                        <DataRow label="Companion Name" value={selectedCompanion.custom_name} />
                        <DataRow label="Companion Gender" value={selectedCompanion.gender} />
                        <DataRow label="Relationship Type" value={selectedCompanion.relationship_type} />
                        <DataRow label="Signature Voice" value={selectedCompanion.signature_voice || 'default'} />
                        <DataRow label="Hobbies" value={selectedCompanion.hobbies?.join(', ') || 'None'} />
                        <DataRow label="Sports" value={selectedCompanion.sports?.join(', ') || 'None'} />
                      </div>
                    </div>

                    <div className="border-t border-slate-700 pt-6 mt-6">
                      <h2 className="text-xl font-semibold text-white mb-4">Questionnaire Preferences</h2>
                      <div className="bg-slate-900/50 rounded-lg p-6 space-y-3">
                        <DataRow label="Dynamic Preference" value={selectedCompanion.dynamic_preference} />
                        <DataRow label="Confrontation Style" value={selectedCompanion.confrontation_style} />
                        <DataRow label="Availability Level" value={selectedCompanion.availability_level} />
                        <DataRow label="Interest Preference" value={selectedCompanion.interest_preference} />
                        <DataRow label="Interest Text" value={selectedCompanion.interest_text} />
                        <DataRow label="Love Language" value={selectedCompanion.love_language} />
                        <DataRow label="Support Style" value={selectedCompanion.support_style} />
                        <DataRow label="Life Context" value={selectedCompanion.life_context} />
                        <DataRow label="Energy Preference" value={selectedCompanion.energy_preference} />
                        <DataRow label="Favorite Color" value={selectedCompanion.favorite_color} />
                        <DataRow label="Music Genre" value={selectedCompanion.music_genre} />
                      </div>
                    </div>

                    <div className="border-t border-slate-700 pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-white">Generated System Prompt</h2>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowPrompt(!showPrompt)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                          >
                            {showPrompt ? <EyeOff size={18} /> : <Eye size={18} />}
                            {showPrompt ? 'Hide' : 'Show'}
                          </button>
                          <button
                            onClick={copyToClipboard}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                          >
                            {copied ? <Check size={18} /> : <Copy size={18} />}
                            {copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      {showPrompt && (
                        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
                          <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto">
                            {generatedPrompt}
                          </pre>
                        </div>
                      )}

                      <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-blue-300">
                          <strong>Prompt Length:</strong> {generatedPrompt.length} characters ({Math.round(generatedPrompt.length / 4)} tokens approx)
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-4">
      <div className="text-gray-400 text-sm font-medium w-48 flex-shrink-0">{label}:</div>
      <div className="text-white text-sm flex-1">
        {value || <span className="text-gray-600 italic">Not set</span>}
      </div>
    </div>
  );
}
