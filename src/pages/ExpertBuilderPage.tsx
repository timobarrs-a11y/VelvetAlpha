import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { useSubscription } from '../hooks/useSubscription';
import { EXPERT_CATEGORIES, getInstructionCharLimit } from '../config/signatureExperts';
import { createUserExpert, updateUserExpert, getUserExperts, sanitizeExpertInstruction } from '../services/expertService';
import type { UserExpertInput } from '../services/expertService';

export function ExpertBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const { tier } = useSubscription();
  const charLimit = getInstructionCharLimit(tier || 'free');

  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [category, setCategory] = useState<string>('lifestyle');
  const [description, setDescription] = useState('');
  const [instruction, setInstruction] = useState('');
  const [checkInStyle, setCheckInStyle] = useState<string>('responsive');
  const [accountabilityLevel, setAccountabilityLevel] = useState<string>('moderate');
  const [sampleInteraction, setSampleInteraction] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (editId && userId) {
      getUserExperts(userId).then(experts => {
        const existing = experts.find(e => e.id === editId);
        if (existing) {
          setName(existing.name);
          setDomain(existing.domain);
          setCategory(existing.category);
          setDescription(existing.description);
          setInstruction(existing.instruction);
          setCheckInStyle(existing.check_in_style);
          setAccountabilityLevel(existing.accountability_level);
          setSampleInteraction(existing.sample_interaction);
        }
      });
    }
  }, [editId, userId]);

  const handleSave = async () => {
    if (!userId || !name.trim() || !domain.trim() || !instruction.trim()) {
      setError('Name, domain, and instruction are required.');
      return;
    }

    setSaving(true);
    setError('');

    const sanitized = sanitizeExpertInstruction(instruction, charLimit);

    const input: UserExpertInput = {
      name: name.trim(),
      domain: domain.trim(),
      category,
      description: description.trim(),
      instruction: sanitized,
      goal_types: [],
      check_in_style: checkInStyle,
      accountability_level: accountabilityLevel,
      sample_interaction: sampleInteraction.trim(),
      is_active: true,
    };

    let result;
    if (editId) {
      result = await updateUserExpert(userId, editId, input);
    } else {
      result = await createUserExpert(userId, input);
    }

    setSaving(false);

    if (result) {
      const intent = sessionStorage.getItem('onboardingIntent');
      if (intent) {
        sessionStorage.setItem('selectedExpertId', result.id);
        sessionStorage.setItem('selectedExpertSource', 'user');
        if (intent === 'expert_only') {
          navigate('/expert-questionnaire');
        } else {
          navigate('/create-companion-avatar');
        }
      } else {
        navigate(-1);
      }
    } else {
      setError('Failed to save. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="text-blue-400" size={24} />
            <h1 className="text-2xl font-bold">
              {editId ? 'Edit Your Expert' : 'Create Your Expert'}
            </h1>
          </div>
          <p className="text-gray-400 mb-8">
            Define your own AI expert with custom instructions and behavior.
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-6">
              <AlertCircle size={16} className="text-red-400" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Expert Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., The Accountability Coach"
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
                maxLength={60}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Domain</label>
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="e.g., productivity, cooking, language learning"
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
                maxLength={40}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Category</label>
              <div className="grid grid-cols-3 gap-2">
                {EXPERT_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      category === cat.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Short Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="One-line summary of what this expert does"
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Instructions
                <span className="text-gray-500 font-normal ml-2">
                  {instruction.length}/{charLimit} characters
                </span>
              </label>
              <textarea
                value={instruction}
                onChange={e => setInstruction(e.target.value.slice(0, charLimit))}
                placeholder="Describe how this expert should behave. What domain knowledge do they have? How do they check in? What's their approach to accountability? What should they never do?"
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors min-h-[200px] resize-y"
                maxLength={charLimit}
              />
              <p className="text-xs text-gray-500 mt-1">
                This defines how your expert behaves. Be specific about their domain, approach, and boundaries.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Check-in Style</label>
                <select
                  value={checkInStyle}
                  onChange={e => setCheckInStyle(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors"
                >
                  <option value="proactive">Proactive</option>
                  <option value="responsive">Responsive</option>
                  <option value="structured">Structured</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Accountability</label>
                <select
                  value={accountabilityLevel}
                  onChange={e => setAccountabilityLevel(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors"
                >
                  <option value="gentle">Gentle</option>
                  <option value="moderate">Moderate</option>
                  <option value="firm">Firm</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Sample Interaction (optional)</label>
              <textarea
                value={sampleInteraction}
                onChange={e => setSampleInteraction(e.target.value)}
                placeholder="An example of how this expert would talk to you..."
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors min-h-[80px] resize-y"
                maxLength={300}
              />
            </div>
          </div>

          <div className="mt-8 pb-8">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || !domain.trim() || !instruction.trim()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-3.5 rounded-xl transition-colors"
            >
              <Save size={18} />
              {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Expert'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
