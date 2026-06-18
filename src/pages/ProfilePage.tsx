import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader, CreditCard as Edit3, Check, X, CreditCard, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { userProfileService, UserProfile } from '../services/userProfileService';
import { colorNameToHex, QUESTIONNAIRE_COLORS } from '../utils/colorMapping';
import { createPortalSession } from '../services/stripeService';
import { useSubscription } from '../hooks/useSubscription';
import { toast } from '../shared/ui/Toast';

function getZodiacSign(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
  return 'Pisces';
}

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const MUSIC_OPTIONS = [
  'R&B/Soul', 'Hip-Hop/Rap', 'Pop', 'Rock/Alternative',
  'Lo-fi/Chill', 'Country', 'A Little Bit Of Everything'
];

const HOBBIES_OPTIONS = [
  'Reading', 'Gaming', 'Cooking', 'Baking', 'Hiking', 'Photography',
  'Drawing/Painting', 'Writing', 'Music (Playing/Listening)', 'Movies/TV Shows',
  'Fitness/Working Out', 'Yoga/Meditation', 'Dancing', 'Gardening',
  'DIY/Crafts', 'Travel/Exploring', 'Fashion/Shopping', 'Cars/Motorcycles',
  'Tech/Gadgets', 'Board Games/Puzzles'
];

const SPORTS_OPTIONS = [
  'Basketball', 'Football (American)', 'Soccer (Football)', 'Baseball',
  'Tennis', 'Golf', 'Hockey (Ice)', 'Volleyball', 'Swimming', 'Running/Track',
  'Boxing/MMA', 'Wrestling', 'Gymnastics', 'Skiing/Snowboarding', 'Surfing',
  'Skateboarding', 'Cycling', 'Martial Arts', 'Cricket', 'Rugby',
  'Badminton', 'Table Tennis', 'Formula 1/Racing', 'E-Sports', 'Not Into Sports'
];

const NEWS_CATEGORIES_OPTIONS = [
  'Politics', 'Science & Technology', 'World News', 'Business & Finance',
  'Sports', 'Entertainment', 'Health & Wellness', 'Climate & Environment'
];

interface EditableFieldProps {
  label: string;
  value: string;
  onSave: (value: string) => void;
  type?: 'text' | 'date' | 'choice' | 'color' | 'tags' | 'multi-choice';
  options?: string[];
  placeholder?: string;
  maxSelections?: number;
}

function EditableField({ label, value, onSave, type = 'text', options, placeholder, maxSelections = 5 }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  useEffect(() => {
    setEditValue(value);
    if (type === 'multi-choice' && value) {
      setSelectedOptions(value.split(', ').filter(v => v));
    }
  }, [value, type]);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setSelectedOptions(value ? value.split(', ').filter(v => v) : []);
    setIsEditing(false);
  };

  const handleMultiChoiceToggle = (option: string) => {
    setSelectedOptions(prev => {
      const newSelected = prev.includes(option)
        ? prev.filter(o => o !== option)
        : prev.length < maxSelections
        ? [...prev, option]
        : prev;
      return newSelected;
    });
  };

  const handleMultiChoiceSave = () => {
    onSave(selectedOptions.join(', '));
    setIsEditing(false);
  };

  if (type === 'color') {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {QUESTIONNAIRE_COLORS.map((color) => {
            const hex = colorNameToHex(color);
            const isSelected = value === color;
            return (
              <button
                key={color}
                onClick={() => onSave(color)}
                className={`w-10 h-10 rounded-full border-2 transition-all duration-200 hover:scale-110 ${
                  isSelected ? 'border-white scale-110 ring-2 ring-white/30' : 'border-gray-600 hover:border-gray-400'
                }`}
                style={{ backgroundColor: hex }}
                title={color}
              />
            );
          })}
        </div>
        {value && (
          <p className="text-sm text-gray-300 mt-3">{value}</p>
        )}
      </div>
    );
  }

  if (type === 'multi-choice' && options) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">{label}</span>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Edit3 className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Select up to {maxSelections} options</p>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {options.map((option) => {
                const isSelected = selectedOptions.includes(option);
                return (
                  <button
                    key={option}
                    onClick={() => handleMultiChoiceToggle(option)}
                    disabled={!isSelected && selectedOptions.length >= maxSelections}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                      isSelected
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                        : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed'
                    }`}
                  >
                    {option}
                    {isSelected && <Check className="w-3 h-3 inline ml-1" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleMultiChoiceSave}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                Save ({selectedOptions.length} selected)
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap gap-2">
              {value ? value.split(', ').map((item, idx) => (
                <span key={idx} className="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-full text-sm border border-rose-500/50">
                  {item}
                </span>
              )) : (
                <span className="text-gray-500 text-sm">None selected</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (type === 'choice' && options) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        </div>
        {isEditing ? (
          <div className="space-y-2">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => { onSave(option); setIsEditing(false); }}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  value === option
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                    : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500 hover:bg-gray-700'
                }`}
              >
                {option}
              </button>
            ))}
            <button
              onClick={handleCancel}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors mt-1"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-lg text-white font-medium">{value || 'Not set'}</span>
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Edit3 className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type={type === 'date' ? 'date' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 bg-gray-700/50 border border-gray-600 text-white rounded-lg text-lg focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
          <button
            onClick={handleSave}
            className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleCancel}
            className="p-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-lg text-white font-medium">{value || 'Not set'}</span>
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Edit3 className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}
    </div>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const { tier } = useSubscription();

  const handleManageBilling = async () => {
    setIsOpeningPortal(true);
    try {
      const url = await createPortalSession();
      window.location.href = url;
    } catch (error) {
      console.error('Error opening billing portal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to open billing portal');
    } finally {
      setIsOpeningPortal(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await userProfileService.getCurrentProfile();
      if (data) {
        await userProfileService.backfillFromCompanion();
        const refreshed = await userProfileService.getCurrentProfile();
        setProfile(refreshed || data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldSave = async (field: string, value: string) => {
    if (!profile) return;
    setIsSaving(true);

    try {
      const updates: Record<string, any> = {};

      if (field === 'hobbies' || field === 'sports' || field === 'news_categories') {
        updates[field] = value ? value.split(',').map(v => v.trim()).filter(v => v) : [];
      } else {
        updates[field] = value || null;
      }

      if (field === 'birthday' && value) {
        updates.zodiac_sign = getZodiacSign(value);
      }

      const updated = await userProfileService.updateProfile(updates);
      if (updated) {
        setProfile(updated);
        setSaveMessage('Saved');
        setTimeout(() => setSaveMessage(null), 2000);
      }
    } catch (error) {
      console.error('Error saving field:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-rose-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 flex items-center justify-center">
        <p className="text-gray-400">Could not load profile.</p>
      </div>
    );
  }

  const favoriteColorHex = profile.favorite_color ? colorNameToHex(profile.favorite_color) : '#3182CE';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/lobby')}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">My Profile</h1>
              <p className="text-gray-400 text-sm mt-1">Update your personal info anytime</p>
            </div>
          </div>
          {(isSaving || saveMessage) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-sm"
            >
              {isSaving ? (
                <>
                  <Loader className="w-4 h-4 animate-spin text-gray-400" />
                  <span className="text-gray-400">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">{saveMessage}</span>
                </>
              )}
            </motion.div>
          )}
        </div>

        <div
          className="w-full h-2 rounded-full mb-10"
          style={{
            background: `linear-gradient(to right, ${favoriteColorHex}, ${favoriteColorHex}88)`
          }}
        />

        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <EditableField
              label="Name"
              value={profile.name || ''}
              onSave={(v) => handleFieldSave('name', v)}
              placeholder="Your name"
            />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <EditableField
              label="Birthday"
              value={profile.birthday || ''}
              onSave={(v) => handleFieldSave('birthday', v)}
              type="date"
            />
          </motion.div>

          {profile.zodiac_sign && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Zodiac Sign</span>
                <p className="text-lg text-white font-medium mt-1">{profile.zodiac_sign}</p>
              </div>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <EditableField
              label="Gender"
              value={profile.gender || ''}
              onSave={(v) => handleFieldSave('gender', v)}
              type="choice"
              options={GENDER_OPTIONS}
            />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <EditableField
              label="Favorite Color"
              value={profile.favorite_color || ''}
              onSave={(v) => handleFieldSave('favorite_color', v)}
              type="color"
            />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <EditableField
              label="Music Genre"
              value={profile.music_genre || ''}
              onSave={(v) => handleFieldSave('music_genre', v)}
              type="choice"
              options={MUSIC_OPTIONS}
            />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <EditableField
              label="Hobbies"
              value={(profile.hobbies || []).join(', ')}
              onSave={(v) => handleFieldSave('hobbies', v)}
              type="multi-choice"
              options={HOBBIES_OPTIONS}
              maxSelections={5}
            />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <EditableField
              label="Sports"
              value={(profile.sports || []).join(', ')}
              onSave={(v) => handleFieldSave('sports', v)}
              type="multi-choice"
              options={SPORTS_OPTIONS}
              maxSelections={5}
            />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <EditableField
              label="News Topics"
              value={(profile.news_categories || []).join(', ')}
              onSave={(v) => handleFieldSave('news_categories', v)}
              type="multi-choice"
              options={NEWS_CATEGORIES_OPTIONS}
              maxSelections={3}
            />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
            <div className="py-3 border-b border-gray-700/50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Political News Preference</p>
              <p className="text-xs text-gray-500 mb-3">Optional — personalizes political news in your Morning Brief.</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: null, label: 'Not specified' },
                  { value: 'democrat', label: 'Democrat' },
                  { value: 'republican', label: 'Republican' },
                  { value: 'independent', label: 'Independent' },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    onClick={() => handleFieldSave('political_leaning', opt.value ?? '')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      profile.political_leaning === opt.value
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                        : 'bg-gray-800/50 border-gray-600/50 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {tier !== 'free' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mt-8"
          >
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-gray-400" />
                  <div>
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Subscription</span>
                    <p className="text-lg text-white font-medium capitalize mt-0.5">{tier === 'unlimited' ? 'Velvet Essential' : tier === 'starter' ? 'Velvet Plus' : tier === 'plus' ? 'Velvet Pro' : tier === 'elite' ? 'Velvet Elite' : tier}</p>
                  </div>
                </div>
                <button
                  onClick={handleManageBilling}
                  disabled={isOpeningPortal}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isOpeningPortal ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">Manage Billing</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {tier === 'free' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8"
          >
            <button
              onClick={() => navigate('/pricing')}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl"
            >
              Upgrade Your Plan
            </button>
          </motion.div>
        )}

        <div className="mt-10 text-center">
          <p className="text-xs text-gray-500">
            Your personal info is used to personalize your companion interactions and Co-Author experience.
          </p>
        </div>
      </div>
    </div>
  );
}
