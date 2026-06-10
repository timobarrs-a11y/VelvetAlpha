import { useState, useCallback, useRef } from 'react';
import { Shuffle, Undo2, Redo2, RotateCcw, Bookmark, BookmarkCheck, X, Sparkles } from 'lucide-react';
import { AvatarV2 } from './AvatarV2';
import {
  AvatarConfigV2, Gender,
  SKIN_TONES, EYE_COLORS, HAIR_COLORS, LIP_COLORS, NECKLACE_COLORS,
  MALE_HAIRSTYLES, FEMALE_HAIRSTYLES,
  DEFAULT_MALE_AVATAR_V2, DEFAULT_FEMALE_AVATAR_V2,
  LipShape, EyebrowShape, FacialHair, Eyelashes, Freckles, Glasses,
  Earrings, NosePiercing, LipPiercing, Necklace,
  EyeShape, NoseShape, FaceShape, BodyType, Tattoo, Blush, Eyeliner,
} from '../types/avatar-v2';
import { AVATAR_PRESETS } from '../data/avatarPresets';
import { useAvatarFavorites } from '../hooks/useAvatarFavorites';
import { trackApplyPreset, trackRandomize } from '../services/avatarAnalytics';

type Tab = 'face' | 'hair' | 'body' | 'accessories' | 'presets';

const HISTORY_LIMIT = 30;

interface AvatarCreatorV2Props {
  initialConfig?: AvatarConfigV2;
  onChange?: (config: AvatarConfigV2) => void;
  draftKey?: string;
  favoritesNamespace?: string;
}

function ColorSwatch({
  color, selected, onClick, title,
}: { color: string; selected: boolean; onClick: () => void; title?: string }) {
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      {children}
    </div>
  );
}

export function AvatarCreatorV2({
  initialConfig,
  onChange,
  draftKey,
  favoritesNamespace = 'default',
}: AvatarCreatorV2Props) {
  const getInitial = (): AvatarConfigV2 => {
    if (draftKey) {
      try {
        const stored = localStorage.getItem(draftKey);
        if (stored) return JSON.parse(stored) as AvatarConfigV2;
      } catch {}
    }
    return initialConfig ?? DEFAULT_MALE_AVATAR_V2;
  };

  const [config, setConfig] = useState<AvatarConfigV2>(getInitial);
  const [tab, setTab] = useState<Tab>('face');
  const history = useRef<AvatarConfigV2[]>([getInitial()]);
  const historyIdx = useRef<number>(0);

  const { favorites, addFavorite, removeFavorite, applyFavorite, maxSlots } = useAvatarFavorites(favoritesNamespace);

  const push = useCallback((next: AvatarConfigV2) => {
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
    setConfig(prev => {
      const next = { ...prev, ...partial };
      push(next);
      return next;
    });
  }, [push]);

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
    const g: Gender = Math.random() > 0.5 ? 'male' : 'female';
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    const skinTones = SKIN_TONES.map(s => s.value);
    const eyeColors = EYE_COLORS.map(e => e.value);
    const hairColors = HAIR_COLORS.map(h => h.value);
    const maleHairStyles = MALE_HAIRSTYLES.map(h => h.value);
    const femaleHairStyles = FEMALE_HAIRSTYLES.map(h => h.value);

    const skinTone = pick(skinTones);

    const warmSkins = ['#fde8d7', '#f4c2a0', '#d4a373'];
    const coolSkins = ['#c68952', '#a86f44', '#6d4428'];
    const isWarmSkin = warmSkins.includes(skinTone);
    const warmLipColors = LIP_COLORS.filter(l =>
      ['#c4917c', '#b07a5e', '#c8857a', '#d88e89', '#e5b8a8', '#f4a6b8', '#e88ba3', '#c73e3a'].includes(l.value)
    ).map(l => l.value);
    const coolLipColors = LIP_COLORS.filter(l =>
      ['#b0726a', '#a0604a', '#c75f7e', '#8b4876'].includes(l.value)
    ).map(l => l.value);
    const allLipColors = LIP_COLORS.map(l => l.value);
    const lipColorPool = Math.random() < 0.65
      ? (isWarmSkin ? warmLipColors : coolLipColors)
      : allLipColors;

    const eyeShapes: EyeShape[] = ['almond', 'round', 'hooded', 'wide'];
    const noseShapes: NoseShape[] = ['button', 'straight', 'broad', 'upturned'];
    const faceShapes: FaceShape[] = ['oval', 'round', 'square', 'heart'];
    const bodyTypes: BodyType[] = ['slim', 'average', 'athletic', 'curvy'];
    const tattoos: Tattoo[] = ['none', 'none', 'none', 'neck', 'forearm', 'collarbone'];
    const blushOpts: Blush[] = ['none', 'soft', 'bold'];
    const freckleOpts: Freckles[] = ['none', 'none', 'light', 'heavy', 'beauty_mark'];
    const glassesOpts: Glasses[] = ['none', 'none', 'none', 'round', 'square', 'cat-eye', 'aviator'];
    const earringOpts: Earrings[] = ['none', 'none', 'studs', 'hoops', 'dangles', 'gauges'];
    const nosePiercingOpts: NosePiercing[] = ['none', 'none', 'none', 'nostril_stud', 'nose_ring'];
    const lipPiercingOpts: LipPiercing[] = ['none', 'none', 'none', 'labret', 'lip_ring', 'snake_bites'];
    const necklaceOpts: Necklace[] = ['none', 'none', 'chain', 'choker', 'pendant', 'pearls'];
    const eyelinerOpts: Eyeliner[] = ['none', 'none', 'none', 'thin', 'winged', 'bold'];

    push({
      gender: g,
      skinTone,
      eyeColor: pick(eyeColors),
      hairColor: pick(hairColors),
      hairStyle: g === 'male' ? pick(maleHairStyles) : pick(femaleHairStyles),
      lipShape: pick(['natural', 'full', 'thin', 'heart'] as LipShape[]),
      lipColor: pick(lipColorPool),
      eyebrowShape: pick(['natural', 'arched', 'straight', 'thick', 'thin'] as EyebrowShape[]),
      eyeShape: pick(eyeShapes),
      noseShape: pick(noseShapes),
      faceShape: pick(faceShapes),
      bodyType: pick(bodyTypes),
      facialHair: g === 'male' ? pick(['none', 'none', 'stubble', 'beard', 'goatee', 'mustache'] as FacialHair[]) : 'none',
      eyelashes: g === 'female' ? pick(['none', 'dramatic'] as Eyelashes[]) : 'none',
      freckles: pick(freckleOpts),
      blush: pick(blushOpts),
      glasses: pick(glassesOpts),
      earrings: pick(earringOpts),
      nosePiercing: pick(nosePiercingOpts),
      lipPiercing: pick(lipPiercingOpts),
      necklace: pick(necklaceOpts),
      necklaceColor: pick(NECKLACE_COLORS).value,
      tattoo: pick(tattoos),
      eyeliner: g === 'female' ? pick(eyelinerOpts) : 'none',
    });
  };

  const hairstyles = config.gender === 'male' ? MALE_HAIRSTYLES : FEMALE_HAIRSTYLES;

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'presets', label: 'Presets' },
    { id: 'face', label: 'Face' },
    { id: 'hair', label: 'Hair' },
    { id: 'body', label: 'Body' },
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
              update(preset.config);
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
          {(['almond', 'round', 'hooded', 'wide'] as EyeShape[]).map(v => (
            <OptionButton key={v} label={v.charAt(0).toUpperCase() + v.slice(1)}
              selected={config.eyeShape === v} onClick={() => update({ eyeShape: v })} />
          ))}
        </div>
      </Section>

      <Section label="Eyebrows">
        <div className="grid grid-cols-3 gap-2">
          {(['natural', 'arched', 'straight', 'thick', 'thin'] as EyebrowShape[]).map(v => (
            <OptionButton key={v} label={v.charAt(0).toUpperCase() + v.slice(1)}
              selected={config.eyebrowShape === v} onClick={() => update({ eyebrowShape: v })} />
          ))}
        </div>
      </Section>

      <Section label="Nose Shape">
        <div className="grid grid-cols-4 gap-2">
          {(['button', 'straight', 'broad', 'upturned'] as NoseShape[]).map(v => (
            <OptionButton key={v} label={v.charAt(0).toUpperCase() + v.slice(1)}
              selected={config.noseShape === v} onClick={() => update({ noseShape: v })} />
          ))}
        </div>
      </Section>

      <Section label="Face Shape">
        <div className="grid grid-cols-4 gap-2">
          {(['oval', 'round', 'square', 'heart'] as FaceShape[]).map(v => (
            <OptionButton key={v} label={v.charAt(0).toUpperCase() + v.slice(1)}
              selected={config.faceShape === v} onClick={() => update({ faceShape: v })} />
          ))}
        </div>
      </Section>

      {config.gender === 'female' && (
        <Section label="Eyelashes">
          <div className="grid grid-cols-2 gap-2">
            {(['none', 'dramatic'] as Eyelashes[]).map(v => (
              <OptionButton key={v} label={v === 'none' ? 'None' : 'Dramatic'}
                selected={config.eyelashes === v} onClick={() => update({ eyelashes: v })} />
            ))}
          </div>
        </Section>
      )}

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
        <div className="grid grid-cols-3 gap-2">
          {hairstyles.map(s => (
            <OptionButton key={s.value} label={s.label}
              selected={config.hairStyle === s.value} onClick={() => update({ hairStyle: s.value as AvatarConfigV2['hairStyle'] })} />
          ))}
        </div>
      </Section>

      <Section label="Hair Color">
        <div className="flex flex-wrap gap-2">
          {HAIR_COLORS.map(c => (
            <ColorSwatch key={c.value} color={c.value} selected={config.hairColor === c.value}
              onClick={() => update({ hairColor: c.value })} title={c.name} />
          ))}
        </div>
      </Section>


      {config.gender === 'male' && (
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
      )}
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
    accessories: accessoriesTab,
  };

  return (
    <div className="flex flex-col lg:flex-row gap-0 h-full min-h-0">
      <div className="lg:w-72 xl:w-80 flex-shrink-0 flex flex-col items-center justify-start py-8 px-6
        bg-gradient-to-b from-[#0d1117] to-[#070c14]
        border-b lg:border-b-0 lg:border-r border-white/5">
        <div className="w-52 h-52 lg:w-64 lg:h-64 rounded-2xl overflow-hidden
          bg-[radial-gradient(ellipse_at_center,_#1e2a3a_0%,_#060a0f_100%)]
          shadow-[0_0_40px_rgba(0,0,0,0.8)] flex items-center justify-center">
          <AvatarV2 config={config} className="w-full h-full" />
        </div>

        <div className="mt-6 w-full space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['male', 'female'] as Gender[]).map(g => (
              <button key={g}
                onClick={() => update({
                  gender: g,
                  hairStyle: g === 'male' ? 'short' : 'sleek',
                  facialHair: 'none',
                  eyelashes: 'none',
                })}
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
              className="flex items-center justify-center py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all">
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
                        bg-[radial-gradient(ellipse_at_center,_#1e2a3a_0%,_#060a0f_100%)]
                        ring-1 ring-white/10 hover:ring-sky-500/50 transition-all"
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

      <div className="flex-1 flex flex-col min-h-0 bg-[#080d14]">
        <div className="flex border-b border-white/5 flex-shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-0 py-3.5 text-sm font-semibold tracking-wide transition-all border-b-2 whitespace-nowrap ${
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

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tabContent[tab]}
        </div>
      </div>
    </div>
  );
}
