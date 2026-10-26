import { useState, useCallback, useRef } from 'react';
import { Shuffle, Undo2, Redo2, RotateCcw, Bookmark, BookmarkCheck, X, Sparkles, Lock } from 'lucide-react';
import { AvatarV2 } from './AvatarV2';
import {
  AvatarConfigV2, Gender, HairTexture,
  SKIN_TONES, EYE_COLORS, HAIR_COLORS, HAIR_FASHION_COLORS, HAIRSTYLE_GROUPS, LIP_COLORS, NECKLACE_COLORS, GLASSES_COLORS, DEFAULT_GLASSES_COLOR,
  FACE_TUNE_SLIDERS, tuneOf,
  HAIRSTYLES, AVATAR_CONFIG_VERSION,
  HAIR_TEXTURES, EYE_SHAPES, NOSE_SHAPES, FACE_SHAPES,
  DEFAULT_MALE_AVATAR_V2, DEFAULT_FEMALE_AVATAR_V2,
  LipShape, EyebrowShape, FacialHair, Eyelashes, Freckles, Glasses,
  Earrings, NosePiercing, LipPiercing, Necklace,
  EyeShape, NoseShape, FaceShape, BodyType, Tattoo, Blush, Eyeliner,
  getSkinUndertone,
} from '../types/avatar-v2';
import { AVATAR_PRESETS } from '../data/avatarPresets';
import {
  AVATAR_KITS, OUTFITS, HEADWEAR, FACE_ACCESSORIES, OUTFIT_COLORS,
  AvatarUnlocks, UnlockResult, kitTier, outfitItem,
} from '../data/avatarItems';
import { canUse, itemId, lookUnlock } from '../data/avatarCatalog';
import { useAvatarUnlocks } from '../hooks/useAvatarUnlocks';
import { migrateAvatarConfig, applyAvatarChange } from '../utils/avatarConfig';
import { useAvatarFavorites } from '../hooks/useAvatarFavorites';
import { trackApplyPreset, trackRandomize } from '../services/avatarAnalytics';

type Tab = 'face' | 'hair' | 'body' | 'wardrobe' | 'accessories' | 'presets';

const HISTORY_LIMIT = 30;

// The preview leans in on whatever the current tab changes: the face up close,
// the whole outfit on Wardrobe.
const TAB_ZOOM: Record<Tab, { scale: number; origin: string }> = {
  face: { scale: 1.55, origin: '50% 38%' },
  hair: { scale: 1.2, origin: '50% 40%' },
  accessories: { scale: 1.2, origin: '50% 46%' },
  body: { scale: 1, origin: '50% 50%' },
  wardrobe: { scale: 1, origin: '50% 50%' },
  presets: { scale: 1, origin: '50% 50%' },
};

interface AvatarCreatorV2Props {
  initialConfig?: AvatarConfigV2;
  onChange?: (config: AvatarConfigV2) => void;
  draftKey?: string;
  favoritesNamespace?: string;
  onRandomize?: (config: AvatarConfigV2) => void;
  // Defaults to the signed-in person's own membership and medals.
  unlocks?: AvatarUnlocks;
}

function ColorSwatch({
  color, selected, onClick, title, lock,
}: { color: string; selected: boolean; onClick: () => void; title?: string; lock?: UnlockResult }) {
  if (lock && !lock.ok) {
    return (
      <button disabled title={`${title ? `${title}: ` : ''}unlocks with ${lockLabel(lock)}`}
        className="relative w-10 h-10 rounded-full ring-1 ring-dashed ring-white/10 cursor-not-allowed opacity-40"
        style={{ backgroundColor: color }}>
        <Lock className="absolute inset-0 m-auto w-3.5 h-3.5 text-white" />
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-10 h-10 rounded-full transition-all duration-150 ${
        selected
          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0f172a] shadow-[0_0_8px_rgba(255,255,255,0.4)]'
          : 'ring-1 ring-white/10 hover:ring-white/30'
      }`}
      style={{ backgroundColor: color === 'transparent' ? undefined : color }}
    >
      {color === 'transparent' && (
        <span className="text-[10px] text-gray-400 font-medium leading-none">None</span>
      )}
    </button>
  );
}

function OptionButton({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 border ${
        selected
          ? 'bg-sky-600 border-sky-500 text-white shadow-sm'
          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
      }`}
    >
      {label}
    </button>
  );
}

function lockLabel(u: UnlockResult): string {
  if (u.ok) return '';
  if (u.need === 'membership') return 'Members';
  if (u.need === 'sims') return 'Velvet Sims shop';
  if (u.need === 'reward') return 'Reward';
  return (u.need ?? 'medal').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' medal';
}

function LockableOption({
  label, selected, onClick, lock,
}: { label: string; selected: boolean; onClick: () => void; lock: UnlockResult }) {
  if (lock.ok) return <OptionButton label={label} selected={selected} onClick={onClick} />;
  return (
    <button
      disabled
      title={`Unlocks with: ${lockLabel(lock)}`}
      className="px-3 py-2 rounded-lg text-sm font-medium border border-dashed border-white/10 bg-white/[0.02] text-gray-500 cursor-not-allowed flex flex-col items-center gap-0.5"
    >
      <span className="flex items-center gap-1"><Lock className="w-3 h-3" />{label}</span>
      <span className="text-[10px] text-amber-500/80 leading-none">{lockLabel(lock)}</span>
    </button>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      {children}
    </div>
  );
}

const WARM_LIP_VALUES = ['#c4917c', '#b07a5e', '#c8857a', '#d88e89', '#e5b8a8', '#f4a6b8', '#e88ba3', '#c73e3a'];
const COOL_LIP_VALUES = ['#b0726a', '#a0604a', '#c75f7e', '#8b4876'];

function coherentRandomize(): AvatarConfigV2 {
  const g: Gender = Math.random() > 0.5 ? 'male' : 'female';
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const skinTone = pick(SKIN_TONES).value;
  const undertone = getSkinUndertone(skinTone);

  const lipColorPool = Math.random() < 0.65
    ? (undertone === 'warm' ? WARM_LIP_VALUES : undertone === 'cool' ? COOL_LIP_VALUES : WARM_LIP_VALUES)
    : LIP_COLORS.map(l => l.value);

  const textures: HairTexture[] = ['straight', 'wavy', 'coily'];
  const hairTexture = pick(textures);

  const compatibleStyles = hairTexture === 'coily'
    ? (g === 'male' ? ['afro', 'locs_short', 'fade', 'short', 'cornrows', 'twists', 'bald', 'barrel_twists'] : ['afro', 'locs', 'braids', 'curly', 'high_puff', 'bantu_knots', 'twists', 'cornrows', 'boho_braids', 'goddess_locs'])
    : hairTexture === 'wavy'
    ? (g === 'male' ? ['short_wavy', 'short', 'slick_back', 'undercut'] : ['wavy', 'sleek', 'curly', 'ponytail', 'bob', 'bangs'])
    : (g === 'male' ? ['buzz', 'short', 'slick_back', 'fade', 'undercut', 'top_knot', 'bald'] : ['sleek', 'ponytail', 'bun', 'wavy', 'bob', 'pixie', 'long_straight', 'bangs']);

  const hairStyle = pick(compatibleStyles) as AvatarConfigV2['hairStyle'];

  const eyeShapes: EyeShape[] = EYE_SHAPES.map(s => s.value);
  const noseShapes: NoseShape[] = NOSE_SHAPES.map(s => s.value);
  const faceShapes: FaceShape[] = FACE_SHAPES.map(s => s.value);
  const bodyTypes: BodyType[] = ['slim', 'average', 'athletic', 'curvy'];
  const tattoos: Tattoo[] = ['none', 'none', 'none', 'none', 'neck', 'forearm', 'collarbone'];
  const blushOpts: Blush[] = ['none', 'none', 'soft', 'bold'];
  const freckleOpts: Freckles[] = ['none', 'none', 'light', 'heavy', 'beauty_mark'];
  const glassesOpts: Glasses[] = ['none', 'none', 'none', 'none', 'round', 'square', 'cat-eye', 'aviator'];
  const earringOpts: Earrings[] = ['none', 'none', 'studs', 'hoops', 'dangles'];
  const nosePiercingOpts: NosePiercing[] = ['none', 'none', 'none', 'nostril_stud'];
  const lipPiercingOpts: LipPiercing[] = ['none', 'none', 'none', 'labret'];
  const necklaceOpts: Necklace[] = ['none', 'none', 'chain', 'choker', 'pendant'];
  const eyelinerOpts: Eyeliner[] = ['none', 'none', 'none', 'thin', 'winged'];

  return {
    _version: AVATAR_CONFIG_VERSION,
    gender: g,
    skinTone,
    eyeColor: pick(EYE_COLORS).value,
    hairColor: pick(HAIR_COLORS).value,
    hairHighlight: Math.random() < 0.15 ? pick([...HAIR_COLORS, ...HAIR_FASHION_COLORS]).value : 'none',
    hairStyle,
    hairTexture,
    lipShape: pick(['natural', 'full', 'thin', 'heart'] as LipShape[]),
    lipColor: pick(lipColorPool),
    eyebrowShape: pick(['natural', 'arched', 'straight', 'rounded', 'thick', 'bushy', 'thin'] as EyebrowShape[]),
    // A little variety in proportions, never extreme.
    faceTune: Object.fromEntries(FACE_TUNE_SLIDERS.map(sl => [sl.key, Math.round((Math.random() * 1.2 - 0.6) * 10) / 10])),
    eyeShape: pick(eyeShapes),
    noseShape: pick(noseShapes),
    faceShape: pick(faceShapes),
    bodyType: pick(bodyTypes),
    facialHair: g === 'male' ? pick(['none', 'none', 'none', 'stubble', 'beard', 'goatee'] as FacialHair[]) : 'none',
    eyelashes: g === 'female' ? pick(['none', 'dramatic'] as Eyelashes[]) : 'none',
    freckles: pick(freckleOpts),
    blush: g === 'female' ? pick(blushOpts) : 'none',
    glasses: pick(glassesOpts),
    glassesColor: pick(GLASSES_COLORS).value,
    earrings: pick(earringOpts),
    nosePiercing: pick(nosePiercingOpts),
    lipPiercing: pick(lipPiercingOpts),
    necklace: pick(necklaceOpts),
    necklaceColor: pick(NECKLACE_COLORS).value,
    tattoo: pick(tattoos),
    eyeliner: g === 'female' ? pick(eyelinerOpts) : 'none',
  };
}

export function AvatarCreatorV2({
  initialConfig,
  onChange,
  draftKey,
  favoritesNamespace = 'default',
  onRandomize,
  unlocks: unlocksProp,
}: AvatarCreatorV2Props) {
  const ownUnlocks = useAvatarUnlocks();
  const unlocks = unlocksProp ?? ownUnlocks;

  const getInitial = (): AvatarConfigV2 => {
    if (draftKey) {
      try {
        const stored = localStorage.getItem(draftKey);
        if (stored) return migrateAvatarConfig(JSON.parse(stored));
      } catch {}
    }
    return migrateAvatarConfig(initialConfig ?? DEFAULT_MALE_AVATAR_V2);
  };

  const [config, setConfig] = useState<AvatarConfigV2>(getInitial);
  const [tab, setTab] = useState<Tab>('face');
  const history = useRef<AvatarConfigV2[]>([getInitial()]);
  const historyIdx = useRef<number>(0);

  const { favorites, addFavorite, removeFavorite, applyFavorite, maxSlots } = useAvatarFavorites(favoritesNamespace);

  const push = useCallback((incoming: AvatarConfigV2) => {
    // Saved looks and presets can be older configs; read them the old way first.
    const next = migrateAvatarConfig(incoming);
    const slice = history.current.slice(0, historyIdx.current + 1);
    slice.push(next);
    if (slice.length > HISTORY_LIMIT) slice.shift();
    history.current = slice;
    historyIdx.current = slice.length - 1;

    setConfig(next);
    onChange?.(next);
    if (draftKey) {
      try { localStorage.setItem(draftKey, JSON.stringify(next)); } catch {}
    }
  }, [draftKey, onChange]);

  const update = useCallback((partial: Partial<AvatarConfigV2>) => {
    // Compute the next config from the current config without nesting a
    // second setState inside this updater. push() calls setConfig itself,
    // so we only need the value here, not a state updater.
    const next = applyAvatarChange(config, partial);
    push(next);
  }, [config, push]);

  const undo = () => {
    if (historyIdx.current <= 0) return;
    historyIdx.current -= 1;
    const prev = history.current[historyIdx.current];
    setConfig(prev);
    onChange?.(prev);
  };

  const redo = () => {
    if (historyIdx.current >= history.current.length - 1) return;
    historyIdx.current += 1;
    const next = history.current[historyIdx.current];
    setConfig(next);
    onChange?.(next);
  };

  const reset = () => {
    const def = config.gender === 'female' ? DEFAULT_FEMALE_AVATAR_V2 : DEFAULT_MALE_AVATAR_V2;
    push(def);
  };

  const randomize = () => {
    trackRandomize();
    // A new face, same clothes: shuffling a pirate should give another pirate.
    const randomized = {
      ...coherentRandomize(),
      outfit: config.outfit, outfitColor: config.outfitColor, outfitAccent: config.outfitAccent,
      headwear: config.headwear, faceAccessory: config.faceAccessory,
    };
    push(randomized);
    onRandomize?.(randomized);
  };

  const hairstyles = HAIRSTYLES;

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'presets', label: 'Presets' },
    { id: 'face', label: 'Face' },
    { id: 'hair', label: 'Hair' },
    { id: 'body', label: 'Body' },
    { id: 'wardrobe', label: 'Wardrobe' },
    { id: 'accessories', label: 'Accessories' },
  ];

  const presetsTab = (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 leading-relaxed">
        Apply a curated look instantly. Your gender is always preserved.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {AVATAR_PRESETS.map(preset => (
          <button
            key={preset.id}
            onClick={() => {
              update({ ...preset.config, hairTexture: preset.config.hairTexture ?? 'straight' });
              trackApplyPreset(preset.id, preset.name);
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-left
              bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20
              transition-all group"
          >
            <span className="text-xl flex-shrink-0 w-8 text-center">{preset.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors truncate">
                {preset.name}
              </p>
              <p className="text-xs text-gray-500 truncate">{preset.description}</p>
            </div>
            <span className="text-xs text-sky-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              Apply
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const faceTab = (
    <div className="space-y-5">
      <Section label="Skin Tone">
        <div className="flex flex-wrap gap-2">
          {SKIN_TONES.map(t => (
            <ColorSwatch key={t.value} color={t.value} selected={config.skinTone === t.value}
              onClick={() => update({ skinTone: t.value })} title={t.name} />
          ))}
        </div>
      </Section>

      <Section label="Eye Color">
        <div className="flex flex-wrap gap-2">
          {EYE_COLORS.map(c => (
            <ColorSwatch key={c.value} color={c.value} selected={config.eyeColor === c.value}
              onClick={() => update({ eyeColor: c.value })} title={c.name} />
          ))}
        </div>
      </Section>

      <Section label="Eye Shape">
        <div className="grid grid-cols-4 gap-2">
          {EYE_SHAPES.map(v => (
            <OptionButton key={v.value} label={v.label}
              selected={config.eyeShape === v.value} onClick={() => update({ eyeShape: v.value })} />
          ))}
        </div>
      </Section>

      <Section label="Eyebrows">
        <div className="grid grid-cols-3 gap-2">
          {(['natural', 'arched', 'straight', 'rounded', 'thick', 'bushy', 'thin'] as EyebrowShape[]).map(v => (
            <OptionButton key={v} label={v.charAt(0).toUpperCase() + v.slice(1)}
              selected={config.eyebrowShape === v} onClick={() => update({ eyebrowShape: v })} />
          ))}
        </div>
      </Section>

      <Section label="Nose Shape">
        <div className="grid grid-cols-4 gap-2">
          {NOSE_SHAPES.map(v => (
            <OptionButton key={v.value} label={v.label}
              selected={config.noseShape === v.value} onClick={() => update({ noseShape: v.value })} />
          ))}
        </div>
      </Section>

      <Section label="Face Shape">
        <div className="grid grid-cols-3 gap-2">
          {FACE_SHAPES.map(v => (
            <OptionButton key={v.value} label={v.label}
              selected={config.faceShape === v.value} onClick={() => update({ faceShape: v.value })} />
          ))}
        </div>
      </Section>

      <Section label="Fine-tune">
        <div className="space-y-3">
          {FACE_TUNE_SLIDERS.map(sl => {
            const value = tuneOf(config.faceTune, sl.key);
            return (
              <label key={sl.key} className="block">
                <span className="mb-1 flex items-center justify-between text-xs text-gray-300">
                  <span>{sl.label}</span>
                  <span className="text-[10px] text-gray-500">{value === 0 ? '' : value < 0 ? sl.low : sl.high}</span>
                </span>
                <input
                  type="range" min={-1} max={1} step={0.1} value={value}
                  onChange={e => update({ faceTune: { ...config.faceTune, [sl.key]: Number(e.target.value) } })}
                  className="w-full accent-sky-500"
                  aria-label={`${sl.label}: ${sl.low} to ${sl.high}`}
                />
                <span className="flex justify-between text-[10px] text-gray-500"><span>{sl.low}</span><span>{sl.high}</span></span>
              </label>
            );
          })}
          {config.faceTune && Object.values(config.faceTune).some(v => v) && (
            <button type="button" onClick={() => update({ faceTune: {} })}
              className="text-xs font-medium text-sky-400 hover:text-sky-300">
              Reset fine-tuning
            </button>
          )}
        </div>
      </Section>

      <Section label="Eyelashes">
        <div className="grid grid-cols-2 gap-2">
          {(['none', 'dramatic'] as Eyelashes[]).map(v => (
            <OptionButton key={v} label={v === 'none' ? 'None' : 'Dramatic'}
              selected={config.eyelashes === v} onClick={() => update({ eyelashes: v })} />
          ))}
        </div>
      </Section>

      <Section label="Eyeliner">
        <div className="grid grid-cols-4 gap-2">
          {([
            { value: 'none', label: 'None' },
            { value: 'thin', label: 'Thin' },
            { value: 'winged', label: 'Winged' },
            { value: 'bold', label: 'Bold' },
          ] as Array<{ value: Eyeliner; label: string }>).map(o => (
            <OptionButton key={o.value} label={o.label}
              selected={(config.eyeliner ?? 'none') === o.value}
              onClick={() => update({ eyeliner: o.value })} />
          ))}
        </div>
      </Section>

      <Section label="Freckles">
        <div className="grid grid-cols-4 gap-2">
          {([
            { value: 'none', label: 'None' },
            { value: 'light', label: 'Light' },
            { value: 'heavy', label: 'Heavy' },
            { value: 'beauty_mark', label: 'Beauty Mark' },
          ] as Array<{ value: Freckles; label: string }>).map(o => (
            <OptionButton key={o.value} label={o.label}
              selected={config.freckles === o.value} onClick={() => update({ freckles: o.value })} />
          ))}
        </div>
      </Section>

      <Section label="Blush">
        <div className="grid grid-cols-3 gap-2">
          {(['none', 'soft', 'bold'] as Blush[]).map(v => (
            <OptionButton key={v} label={v.charAt(0).toUpperCase() + v.slice(1)}
              selected={config.blush === v} onClick={() => update({ blush: v })} />
          ))}
        </div>
      </Section>

      <Section label="Lip Shape">
        <div className="grid grid-cols-4 gap-2">
          {(['natural', 'full', 'thin', 'heart'] as LipShape[]).map(v => (
            <OptionButton key={v} label={v.charAt(0).toUpperCase() + v.slice(1)}
              selected={config.lipShape === v} onClick={() => update({ lipShape: v })} />
          ))}
        </div>
      </Section>

      <Section label="Lip Color">
        <div className="flex flex-wrap gap-2">
          {LIP_COLORS.map(c => (
            <ColorSwatch key={c.value} color={c.value} selected={config.lipColor === c.value}
              onClick={() => update({ lipColor: c.value })} title={c.name} />
          ))}
        </div>
      </Section>
    </div>
  );

  const hairTab = (
    <div className="space-y-5">
      <Section label="Hairstyle">
        <div className="space-y-3">
          {HAIRSTYLE_GROUPS.map(group => (
            <div key={group.label}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{group.label}</p>
              <div className="grid grid-cols-3 gap-2">
                {group.styles.map(value => (
                  <LockableOption key={value} label={hairstyles.find(h => h.value === value)?.label ?? value}
                    lock={canUse(itemId('hairStyle', value), unlocks)}
                    selected={config.hairStyle === value} onClick={() => update({ hairStyle: value })} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Hair Texture">
        <div className="grid grid-cols-3 gap-2">
          {HAIR_TEXTURES.map(v => (
            <OptionButton key={v.value} label={v.label}
              selected={config.hairTexture === v.value} onClick={() => update({ hairTexture: v.value })} />
          ))}
        </div>
      </Section>

      <Section label="Hair Color">
        <div className="flex flex-wrap gap-2">
          {[...HAIR_COLORS, ...HAIR_FASHION_COLORS].map(c => (
            <ColorSwatch key={c.value} color={c.value} selected={config.hairColor === c.value}
              lock={canUse(itemId('hairColor', c.value), unlocks)}
              onClick={() => update({ hairColor: c.value })} title={c.name} />
          ))}
        </div>
      </Section>

      {config.hairStyle !== 'bald' && (
        <Section label="Highlights">
          <div className="flex flex-wrap gap-2">
            <ColorSwatch color="transparent" selected={!config.hairHighlight || config.hairHighlight === 'none'}
              onClick={() => update({ hairHighlight: 'none' })} title="No highlights" />
            {[...HAIR_COLORS, ...HAIR_FASHION_COLORS].filter(c => c.value !== config.hairColor).map(c => (
              <ColorSwatch key={c.value} color={c.value} selected={config.hairHighlight === c.value}
                lock={canUse(itemId('hairHighlight', c.value), unlocks)}
                onClick={() => update({ hairHighlight: c.value })} title={c.name} />
            ))}
          </div>
        </Section>
      )}

      <Section label="Facial Hair">
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'none', label: 'None' },
            { value: 'stubble', label: 'Stubble' },
            { value: 'beard', label: 'Beard' },
            { value: 'goatee', label: 'Goatee' },
            { value: 'mustache', label: 'Mustache' },
          ] as Array<{ value: FacialHair; label: string }>).map(o => (
            <OptionButton key={o.value} label={o.label}
              selected={config.facialHair === o.value} onClick={() => update({ facialHair: o.value })} />
          ))}
        </div>
      </Section>
    </div>
  );

  const bodyTab = (
    <div className="space-y-5">
      <Section label="Body Type">
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'slim', label: 'Slim' },
            { value: 'average', label: 'Average' },
            { value: 'athletic', label: 'Athletic' },
            { value: 'curvy', label: 'Curvy' },
          ] as Array<{ value: BodyType; label: string }>).map(o => (
            <OptionButton key={o.value} label={o.label}
              selected={config.bodyType === o.value} onClick={() => update({ bodyType: o.value })} />
          ))}
        </div>
      </Section>

      <Section label="Tattoo">
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'none', label: 'None' },
            { value: 'neck', label: 'Neck' },
            { value: 'forearm', label: 'Forearm' },
            { value: 'collarbone', label: 'Collarbone' },
          ] as Array<{ value: Tattoo; label: string }>).map(o => (
            <OptionButton key={o.value} label={o.label}
              selected={config.tattoo === o.value} onClick={() => update({ tattoo: o.value })} />
          ))}
        </div>
      </Section>
    </div>
  );

  const currentOutfit = outfitItem(config.outfit);
  const kitButton = (kit: typeof AVATAR_KITS[number]) => {
    const lock = lookUnlock(kit.look, unlocks);
    return (
      <button
        key={kit.id}
        disabled={!lock.ok}
        onClick={() => update(kit.look)}
        title={lock.ok ? kit.description : `Unlocks with: ${lockLabel(lock)}`}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left border transition-all group ${
          lock.ok
            ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
            : 'bg-white/[0.02] border-dashed border-white/10 cursor-not-allowed'
        }`}
      >
        <span className={`text-xl flex-shrink-0 w-8 text-center ${lock.ok ? '' : 'grayscale opacity-60'}`}>{kit.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${lock.ok ? 'text-white group-hover:text-sky-300' : 'text-gray-500'}`}>
            {kit.label}
          </p>
          <p className="text-xs text-gray-500 truncate">{kit.description}</p>
        </div>
        {!lock.ok && (
          <span className="flex items-center gap-1 text-[11px] text-amber-500/80 flex-shrink-0">
            <Lock className="w-3 h-3" />{lockLabel(lock)}
          </span>
        )}
      </button>
    );
  };

  const wardrobeTab = (
    <div className="space-y-5">
      <Section label="Work Looks">
        <div className="grid grid-cols-1 gap-2">
          {AVATAR_KITS.filter(k => kitTier(k) === 'starter').map(kitButton)}
        </div>
      </Section>

      <Section label="Costume Closet">
        <div className="grid grid-cols-1 gap-2">
          {AVATAR_KITS.filter(k => kitTier(k) !== 'starter').map(kitButton)}
        </div>
      </Section>

      <Section label="Outfit">
        <div className="grid grid-cols-3 gap-2">
          {OUTFITS.map(o => (
            <LockableOption key={o.id} label={o.label} lock={canUse(itemId('outfit', o.id), unlocks)}
              selected={currentOutfit.id === o.id}
              onClick={() => update({ outfit: o.id, outfitColor: o.color, outfitAccent: o.accent })} />
          ))}
        </div>
      </Section>

      <Section label={currentOutfit.colorLabel}>
        <div className="flex flex-wrap gap-2">
          {OUTFIT_COLORS.map(c => (
            <ColorSwatch key={c.value} color={c.value} title={c.name}
              selected={(config.outfitColor ?? currentOutfit.color) === c.value}
              onClick={() => update({ outfitColor: c.value })} />
          ))}
        </div>
      </Section>

      <Section label={currentOutfit.accentLabel}>
        <div className="flex flex-wrap gap-2">
          {OUTFIT_COLORS.map(c => (
            <ColorSwatch key={c.value} color={c.value} title={c.name}
              selected={(config.outfitAccent ?? currentOutfit.accent) === c.value}
              onClick={() => update({ outfitAccent: c.value })} />
          ))}
        </div>
      </Section>

      <Section label="Headwear">
        <div className="grid grid-cols-3 gap-2">
          {HEADWEAR.map(h => (
            <LockableOption key={h.id} label={h.label} lock={canUse(itemId('headwear', h.id), unlocks)}
              selected={(config.headwear ?? 'none') === h.id}
              onClick={() => update({ headwear: h.id })} />
          ))}
        </div>
      </Section>

      <Section label="Face">
        <div className="grid grid-cols-3 gap-2">
          {FACE_ACCESSORIES.map(f => (
            <LockableOption key={f.id} label={f.label} lock={canUse(itemId('faceAccessory', f.id), unlocks)}
              selected={(config.faceAccessory ?? 'none') === f.id}
              onClick={() => update({ faceAccessory: f.id })} />
          ))}
        </div>
      </Section>
    </div>
  );

  const accessoriesTab = (
    <div className="space-y-5">
      <Section label="Glasses">
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'none', label: 'None' },
            { value: 'round', label: 'Round' },
            { value: 'square', label: 'Square' },
            { value: 'cat-eye', label: 'Cat-Eye' },
            { value: 'aviator', label: 'Aviator' },
          ] as Array<{ value: Glasses; label: string }>).map(o => (
            <OptionButton key={o.value} label={o.label}
              selected={config.glasses === o.value} onClick={() => update({ glasses: o.value })} />
          ))}
        </div>
      </Section>

      {config.glasses && config.glasses !== 'none' && (
        <Section label="Frame Color">
          <div className="flex flex-wrap gap-2">
            {GLASSES_COLORS.map(c => (
              <ColorSwatch key={c.value} color={c.value} title={c.name}
                selected={(config.glassesColor ?? DEFAULT_GLASSES_COLOR) === c.value}
                onClick={() => update({ glassesColor: c.value })} />
            ))}
          </div>
        </Section>
      )}

      <Section label="Earrings">
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'none', label: 'None' },
            { value: 'studs', label: 'Studs' },
            { value: 'hoops', label: 'Hoops' },
            { value: 'dangles', label: 'Dangles' },
            { value: 'gauges', label: 'Gauges' },
          ] as Array<{ value: Earrings; label: string }>).map(o => (
            <OptionButton key={o.value} label={o.label}
              selected={config.earrings === o.value} onClick={() => update({ earrings: o.value })} />
          ))}
        </div>
      </Section>

      <Section label="Nose Piercing">
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'none', label: 'None' },
            { value: 'nostril_stud', label: 'Nostril Stud' },
            { value: 'nose_ring', label: 'Nose Ring' },
          ] as Array<{ value: NosePiercing; label: string }>).map(o => (
            <OptionButton key={o.value} label={o.label}
              selected={config.nosePiercing === o.value} onClick={() => update({ nosePiercing: o.value })} />
          ))}
        </div>
      </Section>

      <Section label="Lip Piercing">
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'none', label: 'None' },
            { value: 'labret', label: 'Labret' },
            { value: 'lip_ring', label: 'Lip Ring' },
            { value: 'snake_bites', label: 'Snake Bites' },
          ] as Array<{ value: LipPiercing; label: string }>).map(o => (
            <OptionButton key={o.value} label={o.label}
              selected={config.lipPiercing === o.value} onClick={() => update({ lipPiercing: o.value })} />
          ))}
        </div>
      </Section>

      <Section label="Necklace">
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'none', label: 'None' },
            { value: 'chain', label: 'Chain' },
            { value: 'choker', label: 'Choker' },
            { value: 'pendant', label: 'Pendant' },
            { value: 'pearls', label: 'Pearls' },
          ] as Array<{ value: Necklace; label: string }>).map(o => (
            <OptionButton key={o.value} label={o.label}
              selected={config.necklace === o.value} onClick={() => update({ necklace: o.value })} />
          ))}
        </div>
      </Section>

      {config.necklace !== 'none' && (
        <Section label="Necklace Color">
          <div className="flex flex-wrap gap-2">
            {NECKLACE_COLORS.map(c => (
              <ColorSwatch key={c.value} color={c.value} selected={config.necklaceColor === c.value}
                onClick={() => update({ necklaceColor: c.value })} title={c.name} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );

  const tabContent: Record<Tab, React.ReactNode> = {
    presets: presetsTab,
    face: faceTab,
    hair: hairTab,
    body: bodyTab,
    wardrobe: wardrobeTab,
    accessories: accessoriesTab,
  };

  const zoom = TAB_ZOOM[tab];
  const preview = (size: string) => (
    <div className={`${size} rounded-2xl overflow-hidden flex-shrink-0
      bg-white shadow-[0_8px_30px_rgba(0,0,0,0.45)] flex items-center justify-center`}>
      <div className="w-full h-full transition-transform duration-300 ease-out"
        style={{ transform: `scale(${zoom.scale})`, transformOrigin: zoom.origin }}>
        <AvatarV2 config={config} className="w-full h-full" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-0 h-full min-h-0 overflow-y-auto overscroll-contain lg:overflow-visible">
      {/* On wide screens this column stays put while the options scroll past.
          On phones it sits under the options, inside the same scroll. */}
      <div className="lg:w-72 xl:w-80 flex-shrink-0 flex flex-col items-center justify-start py-5 lg:py-8 px-6
        bg-gradient-to-b from-[#0d1117] to-[#070c14]
        border-t lg:border-t-0 lg:border-r border-white/5
        lg:sticky lg:top-0 lg:self-start lg:max-h-screen lg:overflow-y-auto">
        <div className="hidden lg:block">{preview('w-64 h-64')}</div>

        <div className="lg:mt-6 w-full space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['male', 'female'] as Gender[]).map(g => (
              <button key={g}
                onClick={() => update({ gender: g })}
                className={`py-2 rounded-lg text-sm font-semibold transition-all border ${
                  config.gender === g
                    ? 'bg-sky-700 border-sky-600 text-white'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button onClick={randomize} title="Randomize"
              className="flex items-center justify-center py-2 rounded-lg bg-sky-600/20 border border-sky-500/30 text-sky-400 hover:bg-sky-600/30 hover:text-sky-300 transition-all">
              <Shuffle className="w-4 h-4" />
            </button>
            <button onClick={undo} title="Undo"
              className="flex items-center justify-center py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30"
              disabled={historyIdx.current <= 0}>
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={redo} title="Redo"
              className="flex items-center justify-center py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30"
              disabled={historyIdx.current >= history.current.length - 1}>
              <Redo2 className="w-4 h-4" />
            </button>
            <button onClick={reset} title="Reset to Default"
              className="flex items-center justify-center py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Saved Looks</p>
              <button
                onClick={() => addFavorite(config)}
                title="Save current look"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs
                  text-gray-400 hover:text-sky-300 hover:bg-white/5 border border-transparent
                  hover:border-white/10 transition-all"
              >
                {favorites.length >= maxSlots ? (
                  <BookmarkCheck className="w-3.5 h-3.5 text-sky-400" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
                Save
              </button>
            </div>

            <div className="flex gap-2">
              {Array.from({ length: maxSlots }).map((_, i) => {
                const slot = favorites[i];
                return slot ? (
                  <div key={i} className="relative group flex-1">
                    <button
                      onClick={() => {
                        const cfg = applyFavorite(i);
                        if (cfg) push(cfg);
                      }}
                      title={`Apply saved look ${i + 1}`}
                      className="w-full aspect-square rounded-xl overflow-hidden
                        bg-white ring-1 ring-white/10 hover:ring-sky-500/50 transition-all"
                    >
                      <AvatarV2 config={slot.config} className="w-full h-full" />
                    </button>
                    <button
                      onClick={() => removeFavorite(i)}
                      title="Remove"
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full
                        bg-gray-700 border border-white/20 text-gray-300
                        flex items-center justify-center
                        opacity-0 group-hover:opacity-100 transition-opacity
                        hover:bg-red-900 hover:text-red-300"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    key={i}
                    onClick={() => addFavorite(config)}
                    title="Save current look here"
                    className="flex-1 aspect-square rounded-xl
                      bg-white/3 border border-white/8 border-dashed
                      flex items-center justify-center
                      text-gray-600 hover:text-gray-400 hover:border-white/20
                      transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-none lg:flex-1 flex flex-col lg:min-h-0 bg-[#080d14] order-first lg:order-none">
        {/* On phones the avatar rides along at the top while you scroll the options. */}
        <div className="sticky top-0 z-20 bg-[#080d14] flex-shrink-0">
          <div className="lg:hidden flex items-center justify-center gap-4 pt-4 pb-3 px-4">
            {preview('w-32 h-32')}
            <div className="flex flex-col gap-2">
              <button onClick={randomize} title="Randomize"
                className="flex items-center justify-center w-10 h-9 rounded-lg bg-sky-600/20 border border-sky-500/30 text-sky-400">
                <Shuffle className="w-4 h-4" />
              </button>
              <button onClick={undo} title="Undo" disabled={historyIdx.current <= 0}
                className="flex items-center justify-center w-10 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-400 disabled:opacity-30">
                <Undo2 className="w-4 h-4" />
              </button>
              <button onClick={redo} title="Redo" disabled={historyIdx.current >= history.current.length - 1}
                className="flex items-center justify-center w-10 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-400 disabled:opacity-30">
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex border-b border-white/5 flex-shrink-0 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-shrink-0 lg:flex-1 lg:min-w-0 px-4 py-3.5 text-sm font-semibold tracking-wide transition-all border-b-2 whitespace-nowrap ${
                  tab === t.id
                    ? t.id === 'presets'
                      ? 'text-amber-400 border-amber-500'
                      : 'text-sky-400 border-sky-500'
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                }`}
              >
                {t.id === 'presets' ? '✦ Presets' : t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:flex-1 lg:overflow-y-auto p-5 space-y-5">
          {tabContent[tab]}
        </div>
      </div>
    </div>
  );
}

export { coherentRandomize };
