import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Check, Plus, X, Gift, Heart,
  Link as LinkIcon, Loader2, Trash2, MapPin, Cake,
} from 'lucide-react';
import {
  realPeopleService,
  RealPerson,
} from '../services/realPeopleService';
import { getAvatarStyle, getInitials } from '../components/PeoplePanel';

const RELATIONSHIPS = [
  'girlfriend', 'boyfriend', 'partner', 'wife', 'husband',
  'mom', 'dad', 'sister', 'brother', 'friend', 'best friend',
  'coworker', 'boss', 'neighbor', 'other',
];

export function PersonProfilePage() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const [person, setPerson] = useState<RealPerson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState<Partial<RealPerson>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!personId) return;
    (async () => {
      try {
        const all = await realPeopleService.getAll();
        const found = all.find(p => p.id === personId);
        if (found) {
          setPerson(found);
          setEditForm(found);
        }
      } catch (err) {
        console.error('Failed to load person', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [personId]);

  const handleSave = async () => {
    if (!person || !personId) return;
    setIsSaving(true);
    try {
      await realPeopleService.update(personId, editForm);
      setPerson(prev => prev ? { ...prev, ...editForm } as RealPerson : null);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!personId) return;
    try {
      await realPeopleService.remove(personId);
      navigate('/navi');
    } catch (err) {
      console.error('Failed to delete', err);
    }
  };

  const toggleArrayField = (field: keyof RealPerson, value: string) => {
    const arr = (editForm[field] as string[]) || [];
    const next = arr.includes(value)
      ? arr.filter(v => v !== value)
      : [...arr, value];
    setEditForm(prev => ({ ...prev, [field]: next }));
  };

  const addCustomToArray = (field: keyof RealPerson) => {
    const raw = customInputs[field]?.trim();
    if (!raw) return;
    const arr = (editForm[field] as string[]) || [];
    if (!arr.includes(raw)) {
      setEditForm(prev => ({ ...prev, [field]: [...arr, raw] }));
    }
    setCustomInputs(prev => ({ ...prev, [field]: '' }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-[#08090d] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-white/40 text-sm">Person not found.</p>
        <button onClick={() => navigate('/navi')} className="mt-4 text-emerald-400 text-sm">
          Back to Navi
        </button>
      </div>
    );
  }

  const style = getAvatarStyle(person.avatar_color);

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-white/8 bg-[#08090d]/95 backdrop-blur-xl sticky top-0 z-10">
        <button
          onClick={() => navigate('/navi')}
          className="p-2 hover:bg-white/8 rounded-lg transition-colors text-white/60 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-white text-lg tracking-tight">{person.name}</h1>
          <p className="text-[10px] text-white/35 capitalize">{person.relationship}</p>
        </div>
        {isEditing ? (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600/80 hover:bg-emerald-600 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/8 hover:bg-white/12 border border-white/12 rounded-lg text-sm font-medium text-white/80 hover:text-white transition-all"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              Survey link
            </button>
            <button
              onClick={() => { setEditForm(person); setIsEditing(true); }}
              className="px-3 py-2 bg-white/8 hover:bg-white/12 border border-white/12 rounded-lg text-sm font-medium text-white/80 hover:text-white transition-all"
            >
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 bg-white/4 hover:bg-red-500/10 border border-white/8 hover:border-red-500/30 rounded-lg text-white/40 hover:text-red-400 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-20">
        {/* Avatar + summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className={`w-16 h-16 rounded-2xl ${style.bg} ${style.border} border flex items-center justify-center flex-shrink-0`}>
            <span className={`text-lg font-bold ${style.text}`}>{getInitials(person.name)}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{person.name}</h2>
            <p className="text-white/40 text-sm capitalize">{person.relationship}</p>
            {person.survey_completed && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/70 mt-1">
                <Check className="w-3 h-3" />
                Survey completed
              </span>
            )}
          </div>
        </motion.div>

        {/* Quick info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {person.birthday && (
            <InfoCard icon={<Cake className="w-4 h-4" />} label="Birthday" value={formatBirthday(person.birthday)} />
          )}
          {person.city && (
            <InfoCard icon={<MapPin className="w-4 h-4" />} label="Location" value={`${person.city}${person.state ? `, ${person.state}` : ''}`} />
          )}
          {person.favorite_color && (
            <InfoCard icon={<Heart className="w-4 h-4" />} label="Favorite color" value={person.favorite_color} />
          )}
        </div>

        {isEditing ? (
          <EditForm
            editForm={editForm}
            setEditForm={setEditForm}
            customInputs={customInputs}
            setCustomInputs={setCustomInputs}
            toggleArrayField={toggleArrayField}
            addCustomToArray={addCustomToArray}
          />
        ) : (
          <ViewForm person={person} />
        )}
      </div>

      {/* Share modal */}
      {showShareModal && (
        <ShareModalSimple person={person} onClose={() => setShowShareModal(false)} />
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-[#111218] border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <p className="text-white font-semibold mb-2">Remove {person.name}?</p>
            <p className="text-white/40 text-sm mb-6">All their preferences and survey data will be deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-2.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white/70 rounded-xl text-sm">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 bg-red-500/80 hover:bg-red-500 text-white rounded-xl text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBirthday(birthday: string): string {
  const date = new Date(birthday);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white/4 border border-white/8 rounded-xl">
      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-emerald-400/70 flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-sm text-white/80 truncate">{value}</p>
      </div>
    </div>
  );
}

const FIELD_LABELS: Array<{ field: keyof RealPerson; label: string }> = [
  { field: 'hobbies', label: 'Hobbies & interests' },
  { field: 'favorite_foods', label: 'Favorite foods' },
  { field: 'dietary_restrictions', label: 'Dietary restrictions' },
  { field: 'favorite_tv_shows', label: 'TV shows' },
  { field: 'movie_genres', label: 'Movie genres' },
  { field: 'sports_teams', label: 'Sports & teams' },
  { field: 'music_genres', label: 'Music' },
  { field: 'travel_destinations', label: 'Dream destinations' },
];

function ViewForm({ person }: { person: RealPerson }) {
  const hasData = person.things_mentioned_wanting || FIELD_LABELS.some(f => {
    const v = person[f.field];
    return Array.isArray(v) && v.length > 0;
  });

  if (!hasData && !person.birthday && !person.city && !person.favorite_color) {
    return (
      <div className="text-center py-12 px-4">
        <Gift className="w-10 h-10 text-white/15 mx-auto mb-3" />
        <p className="text-white/40 text-sm">No details yet.</p>
        <p className="text-white/25 text-xs mt-1">
          Click Edit to fill in their preferences, or send them a survey link to do it themselves.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {FIELD_LABELS.map(({ field, label }) => {
        const arr = person[field] as string[];
        if (!arr || arr.length === 0) return null;
        return (
          <div key={field}>
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2">{label}</p>
            <div className="flex flex-wrap gap-1.5">
              {arr.map(v => (
                <span key={v} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70">
                  {v}
                </span>
              ))}
            </div>
          </div>
        );
      })}

      {person.things_mentioned_wanting && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2">Things they have mentioned wanting</p>
          <p className="text-sm text-white/70 leading-relaxed bg-white/4 border border-white/8 rounded-xl p-4">
            {person.things_mentioned_wanting}
          </p>
        </div>
      )}

      {(person.clothing_size_shirt || person.clothing_size_shoe || person.clothing_size_dress || person.ring_size) && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2">Sizes</p>
          <div className="flex flex-wrap gap-2">
            {person.clothing_size_shirt && <SizeChip label="Shirt" value={person.clothing_size_shirt} />}
            {person.clothing_size_shoe && <SizeChip label="Shoe" value={person.clothing_size_shoe} />}
            {person.clothing_size_dress && <SizeChip label="Dress" value={person.clothing_size_dress} />}
            {person.ring_size && <SizeChip label="Ring" value={person.ring_size} />}
          </div>
        </div>
      )}
    </div>
  );
}

function SizeChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
      <span className="text-[10px] text-white/30 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-white/70">{value}</span>
    </div>
  );
}

function EditForm({
  editForm,
  setEditForm,
  customInputs,
  setCustomInputs,
  toggleArrayField,
  addCustomToArray,
}: {
  editForm: Partial<RealPerson>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<RealPerson>>>;
  customInputs: Record<string, string>;
  setCustomInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  toggleArrayField: (field: keyof RealPerson, value: string) => void;
  addCustomToArray: (field: keyof RealPerson) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Basic fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField label="Name" value={editForm.name || ''} onChange={v => setEditForm(prev => ({ ...prev, name: v }))} />
        <div>
          <label className="block text-[10px] text-white/30 uppercase tracking-wide font-medium mb-1.5">Relationship</label>
          <select
            value={editForm.relationship || 'friend'}
            onChange={e => setEditForm(prev => ({ ...prev, relationship: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/40 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none transition-colors capitalize"
          >
            {RELATIONSHIPS.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
          </select>
        </div>
        <TextField label="Birthday" type="date" value={editForm.birthday || ''} onChange={v => setEditForm(prev => ({ ...prev, birthday: v }))} />
        <TextField label="City" value={editForm.city || ''} onChange={v => setEditForm(prev => ({ ...prev, city: v }))} placeholder="e.g. Orlando" />
        <TextField label="State" value={editForm.state || ''} onChange={v => setEditForm(prev => ({ ...prev, state: v }))} placeholder="e.g. FL" />
        <TextField label="Favorite color" value={editForm.favorite_color || ''} onChange={v => setEditForm(prev => ({ ...prev, favorite_color: v }))} placeholder="e.g. Blue" />
      </div>

      {/* Array fields */}
      {FIELD_LABELS.map(({ field, label }) => (
        <ArrayField
          key={field}
          label={label}
          field={field}
          values={(editForm[field] as string[]) || []}
          customValue={customInputs[field] || ''}
          onCustomChange={v => setCustomInputs(prev => ({ ...prev, [field]: v }))}
          onToggle={v => toggleArrayField(field, v)}
          onAddCustom={() => addCustomToArray(field)}
        />
      ))}

      {/* Sizes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TextField label="Shirt size" value={editForm.clothing_size_shirt || ''} onChange={v => setEditForm(prev => ({ ...prev, clothing_size_shirt: v }))} optional />
        <TextField label="Shoe size" value={editForm.clothing_size_shoe || ''} onChange={v => setEditForm(prev => ({ ...prev, clothing_size_shoe: v }))} optional />
        <TextField label="Dress size" value={editForm.clothing_size_dress || ''} onChange={v => setEditForm(prev => ({ ...prev, clothing_size_dress: v }))} optional />
        <TextField label="Ring size" value={editForm.ring_size || ''} onChange={v => setEditForm(prev => ({ ...prev, ring_size: v }))} optional />
      </div>

      {/* Things mentioned wanting */}
      <div>
        <label className="block text-[10px] text-white/30 uppercase tracking-wide font-medium mb-1.5">Things they have mentioned wanting</label>
        <textarea
          value={editForm.things_mentioned_wanting || ''}
          onChange={e => setEditForm(prev => ({ ...prev, things_mentioned_wanting: e.target.value }))}
          placeholder="Things they have mentioned wanting but never bought..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/40 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none transition-colors resize-none"
        />
      </div>
    </div>
  );
}

function TextField({
  label, value, onChange, placeholder, type = 'text', optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] text-white/30 uppercase tracking-wide font-medium mb-1.5">
        {label}{optional && <span className="text-white/15 ml-1">(optional)</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/40 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none transition-colors"
      />
    </div>
  );
}

function ArrayField({
  label, field, values, customValue, onCustomChange, onToggle, onAddCustom,
}: {
  label: string;
  field: keyof RealPerson;
  values: string[];
  customValue: string;
  onCustomChange: (v: string) => void;
  onToggle: (v: string) => void;
  onAddCustom: () => void;
}) {
  void field;
  return (
    <div>
      <label className="block text-[10px] text-white/30 uppercase tracking-wide font-medium mb-1.5">{label}</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map(v => (
            <button
              key={v}
              onClick={() => onToggle(v)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-sm text-emerald-200 hover:bg-emerald-500/20 transition-all"
            >
              {v}
              <X className="w-3 h-3 text-emerald-300/50" />
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={customValue}
          onChange={e => onCustomChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAddCustom();
            }
          }}
          placeholder="Type and press Enter..."
          className="flex-1 bg-white/5 border border-white/10 focus:border-emerald-500/40 rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none transition-colors"
        />
        <button
          onClick={onAddCustom}
          disabled={!customValue.trim()}
          className="px-3 py-2 bg-white/8 hover:bg-white/14 border border-white/12 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-40 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ShareModalSimple({ person, onClose }: { person: RealPerson; onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const existing = await realPeopleService.getSurveyTokens(person.id);
        if (existing.length > 0) {
          setToken(existing[0]);
        } else {
          const newToken = await realPeopleService.createSurveyToken(person.id);
          setToken(newToken);
        }
      } catch (err) {
        console.error('Failed to generate link', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [person.id]);

  const url = token ? realPeopleService.buildSurveyUrl(token) : '';

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!url) return;
    if (navigator.share) {
      await navigator.share({ title: `Help me get to know you, ${person.name}`, text: 'Fill out this quick survey!', url });
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#111218] border border-white/10 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <LinkIcon className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Survey link for {person.name}</h3>
            <p className="text-white/40 text-xs mt-0.5">No account needed — they just open and fill it out</p>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 text-emerald-400 animate-spin" /></div>
        ) : url ? (
          <>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4">
              <p className="text-xs text-emerald-300/80 break-all font-mono">{url}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCopy} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${copied ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-white/8 hover:bg-white/14 border-white/12 text-white'}`}>
                {copied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={handleShare} className="flex-1 px-4 py-2.5 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium">Share</button>
            </div>
          </>
        ) : (
          <p className="text-sm text-red-400/80">Failed to generate link.</p>
        )}
      </div>
    </div>
  );
}
