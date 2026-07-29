import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { AvatarV2 } from './AvatarV2';
import { AvatarConfigV2, Gender, SKIN_TONES, EYE_COLORS, LIP_COLORS, HAIR_COLORS, MALE_HAIRSTYLES, FEMALE_HAIRSTYLES, DEFAULT_MALE_AVATAR_V2, DEFAULT_FEMALE_AVATAR_V2, EyeShape, EyebrowShape, NoseShape, FaceShape, LipShape, FacialHair, Eyelashes, Freckles, Blush, BodyType, Tattoo, Glasses, Earrings, NosePiercing, LipPiercing, Necklace, NECKLACE_COLORS } from '../types/avatar-v2';

type GuidedStep = 'face' | 'hair' | 'body' | 'accessories';

const STEPS: Array<{ id: GuidedStep; label: string; description: string }> = [
  { id: 'face', label: 'Face', description: 'Skin, eyes, lips and facial features' },
  { id: 'hair', label: 'Hair', description: 'Style, color and highlights' },
  { id: 'body', label: 'Body', description: 'Body type and tattoos' },
  { id: 'accessories', label: 'Accessories', description: 'Glasses, piercings and jewelry' },
];

function ColorSwatch({ color, selected, onClick, title }: { color: string; selected: boolean; onClick: () => void; title?: string }) {
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
      {color === 'transparent' && <span className="text-[10px] text-gray-400 font-medium leading-none">None</span>}
    </button>
  );
}

function OptionBtn({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
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

function Sect({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      {children}
    </div>
  );
}

interface GuidedAvatarFlowProps {
  config: AvatarConfigV2;
  onChange: (config: AvatarConfigV2) => void;
  onSwitchToAdvanced: () => void;
}

export function GuidedAvatarFlow({ config, onChange, onSwitchToAdvanced }: GuidedAvatarFlowProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = STEPS[stepIndex];

  const update = useCallback((partial: Partial<AvatarConfigV2>) => {
    onChange({ ...config, ...partial });
  }, [config, onChange]);

  const hairstyles = config.gender === 'male' ? MALE_HAIRSTYLES : FEMALE_HAIRSTYLES;

  const canGoBack = stepIndex > 0;
  const canGoNext = stepIndex < STEPS.length - 1;

  const faceContent = (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 mb-2">
        {(['male', 'female'] as Gender[]).map(g => (
          <button key={g}
            onClick={() => update({
              gender: g,
              hairStyle: g === 'male' ? 'short' : 'sleek',
              facialHair: 'none',
              eyelashes: 'none',
              ...(g === 'male' ? DEFAULT_MALE_AVATAR_V2 : DEFAULT_FEMALE_AVATAR_V2),
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

      <Sect label="Skin Tone">
        <div className="flex flex-wrap gap-2">
          {SKIN_TONES.map(t => (
            <ColorSwatch key={t.value} color={t.value} selected={config.skinTone === t.value}
              onClick={() => update({ skinTone: t.value })} title={t.name} />
          ))}
        </div>
      </Sect>

      <Sect label="Eye Color">
        <div className="flex flex-wrap gap-2">
          {EYE_COLORS.map(c => (
            <ColorSwatch key={c.value} color={c.value} selected={config.eyeColor === c.value}
              onClick={() => update({ eyeColor: c.value })} title={c.name} />
          ))}
        </div>
      </Sect>

      <Sect label="Eye Shape">
        <div className="grid grid-cols-4 gap-2">
          {(['almond', 'round', 'hooded', 'wide'] as EyeShape[]).map(v => (
            <OptionBtn key={v} label={v.charAt(0).toUpperCase() + v.slice(1)}
              selected={config.eyeShape === v} onClick={() => update({ eyeShape: v })} />
          ))}
        </div>
      </Sect>

      <Sect label="Eyebrows">
        <div className="grid grid-cols-3 gap-2">
          {(['natural', 'arched', 'straight', 'thick', 'thin'] as EyebrowShape[]).map(v => (
            <OptionBtn key={v} label={v.charAt(0).toUpperCase() + v.slice(1)}
              selected={config.eyebrowShape === v} onClick={() => update({ eyebrowShape: v })} />
          ))}
        </div>
      </Sect>

      <Sect label="Nose Shape">
        <div className="grid grid-cols-4 gap-2">
          {(['button', 'straight', 'broad', 'upturned'] as NoseShape[]).map(v => (
            <OptionBtn key={v} label={v.charAt(0).toUpperCase() + v.slice(1)}
              selected={config.noseShape === v} onClick={() => update({ noseShape: v })} />
          ))}
        </div>
      </Sect>

      <Sect label="Face Shape">
        <div className="grid grid-cols-4 gap-2">
          {(['oval', 'round', 'square', 'heart'] as FaceShape[]).map(v => (
            <OptionBtn key={v} label={v.charAt(0).toUpperCase() + v.slice(1)}
              selected={config.faceShape === v} onClick={() => update({ faceShape: v })} />
          ))}
        </div>
      </Sect>

      <Sect label="Lip Shape">
        <div className="grid grid-cols-4 gap-2">
          {(['natural', 'full', 'thin', 'heart'] as LipShape[]).map(v => (
            <OptionBtn key={v} label={v.charAt(0).toUpperCase() + v.slice(1)}
              selected={config.lipShape === v} onClick={() => update({ lipShape: v })} />
          ))}
        </div>
      </Sect>

      <Sect label="Lip Color">
        <div className="flex flex-wrap gap-2">
          {LIP_COLORS.map(c => (
            <ColorSwatch key={c.value} color={c.value} selected={config.lipColor === c.value}
              onClick={() => update({ lipColor: c.value })} title={c.name} />
          ))}
        </div>
      </Sect>

      {config.gender === 'female' && (
        <Sect label="Eyelashes">
          <div className="grid grid-cols-2 gap-2">
            {(['none', 'dramatic'] as Eyelashes[]).map(v => (
              <OptionBtn key={v} label={v === 'none' ? 'None' : 'Dramatic'}
                selected={config.eyelashes === v} onClick={() => update({ eyelashes: v })} />
            ))}
          </div>
        </Sect>
      )}

      <Sect label="Blush">
        <div className="grid grid-cols-3 gap-2">
          {(['none', 'soft', 'bold'] as Blush[]).map(v => (
            <OptionBtn key={v} label={v.charAt(0).toUpperCase() + v.slice(1)}
              selected={config.blush === v} onClick={() => update({ blush: v })} />
          ))}
        </div>
      </Sect>

      <Sect label="Freckles">
        <div className="grid grid-cols-4 gap-2">
          {([{ value: 'none', label: 'None' }, { value: 'light', label: 'Light' }, { value: 'heavy', label: 'Heavy' }, { value: 'beauty_mark', label: 'Beauty Mark' }] as Array<{ value: Freckles; label: string }>).map(o => (
            <OptionBtn key={o.value} label={o.label}
              selected={config.freckles === o.value} onClick={() => update({ freckles: o.value })} />
          ))}
        </div>
      </Sect>
    </div>
  );

  const hairContent = (
    <div className="space-y-5">
      <Sect label="Hairstyle">
        <div className="grid grid-cols-3 gap-2">
          {hairstyles.map(s => (
            <OptionBtn key={s.value} label={s.label}
              selected={config.hairStyle === s.value} onClick={() => update({ hairStyle: s.value as AvatarConfigV2['hairStyle'] })} />
          ))}
        </div>
      </Sect>
      <Sect label="Hair Color">
        <div className="flex flex-wrap gap-2">
          {HAIR_COLORS.map(c => (
            <ColorSwatch key={c.value} color={c.value} selected={config.hairColor === c.value}
              onClick={() => update({ hairColor: c.value })} title={c.name} />
          ))}
        </div>
      </Sect>
      {config.gender === 'male' && (
        <Sect label="Facial Hair">
          <div className="grid grid-cols-3 gap-2">
            {([{ value: 'none', label: 'None' }, { value: 'stubble', label: 'Stubble' }, { value: 'beard', label: 'Beard' }, { value: 'goatee', label: 'Goatee' }, { value: 'mustache', label: 'Mustache' }] as Array<{ value: FacialHair; label: string }>).map(o => (
              <OptionBtn key={o.value} label={o.label}
                selected={config.facialHair === o.value} onClick={() => update({ facialHair: o.value })} />
            ))}
          </div>
        </Sect>
      )}
    </div>
  );

  const bodyContent = (
    <div className="space-y-5">
      <Sect label="Body Type">
        <div className="grid grid-cols-2 gap-2">
          {([{ value: 'slim', label: 'Slim' }, { value: 'average', label: 'Average' }, { value: 'athletic', label: 'Athletic' }, { value: 'curvy', label: 'Curvy' }] as Array<{ value: BodyType; label: string }>).map(o => (
            <OptionBtn key={o.value} label={o.label}
              selected={config.bodyType === o.value} onClick={() => update({ bodyType: o.value })} />
          ))}
        </div>
      </Sect>
      <Sect label="Tattoo">
        <div className="grid grid-cols-2 gap-2">
          {([{ value: 'none', label: 'None' }, { value: 'neck', label: 'Neck' }, { value: 'forearm', label: 'Forearm' }, { value: 'collarbone', label: 'Collarbone' }] as Array<{ value: Tattoo; label: string }>).map(o => (
            <OptionBtn key={o.value} label={o.label}
              selected={config.tattoo === o.value} onClick={() => update({ tattoo: o.value })} />
          ))}
        </div>
      </Sect>
    </div>
  );

  const accessoriesContent = (
    <div className="space-y-5">
      <Sect label="Glasses">
        <div className="grid grid-cols-3 gap-2">
          {([{ value: 'none', label: 'None' }, { value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }, { value: 'cat-eye', label: 'Cat-Eye' }, { value: 'aviator', label: 'Aviator' }] as Array<{ value: Glasses; label: string }>).map(o => (
            <OptionBtn key={o.value} label={o.label}
              selected={config.glasses === o.value} onClick={() => update({ glasses: o.value })} />
          ))}
        </div>
      </Sect>
      <Sect label="Earrings">
        <div className="grid grid-cols-3 gap-2">
          {([{ value: 'none', label: 'None' }, { value: 'studs', label: 'Studs' }, { value: 'hoops', label: 'Hoops' }, { value: 'dangles', label: 'Dangles' }, { value: 'gauges', label: 'Gauges' }] as Array<{ value: Earrings; label: string }>).map(o => (
            <OptionBtn key={o.value} label={o.label}
              selected={config.earrings === o.value} onClick={() => update({ earrings: o.value })} />
          ))}
        </div>
      </Sect>
      <Sect label="Nose Piercing">
        <div className="grid grid-cols-3 gap-2">
          {([{ value: 'none', label: 'None' }, { value: 'nostril_stud', label: 'Nostril Stud' }, { value: 'nose_ring', label: 'Nose Ring' }] as Array<{ value: NosePiercing; label: string }>).map(o => (
            <OptionBtn key={o.value} label={o.label}
              selected={config.nosePiercing === o.value} onClick={() => update({ nosePiercing: o.value })} />
          ))}
        </div>
      </Sect>
      <Sect label="Lip Piercing">
        <div className="grid grid-cols-2 gap-2">
          {([{ value: 'none', label: 'None' }, { value: 'labret', label: 'Labret' }, { value: 'lip_ring', label: 'Lip Ring' }, { value: 'snake_bites', label: 'Snake Bites' }] as Array<{ value: LipPiercing; label: string }>).map(o => (
            <OptionBtn key={o.value} label={o.label}
              selected={config.lipPiercing === o.value} onClick={() => update({ lipPiercing: o.value })} />
          ))}
        </div>
      </Sect>
      <Sect label="Necklace">
        <div className="grid grid-cols-3 gap-2">
          {([{ value: 'none', label: 'None' }, { value: 'chain', label: 'Chain' }, { value: 'choker', label: 'Choker' }, { value: 'pendant', label: 'Pendant' }, { value: 'pearls', label: 'Pearls' }] as Array<{ value: Necklace; label: string }>).map(o => (
            <OptionBtn key={o.value} label={o.label}
              selected={config.necklace === o.value} onClick={() => update({ necklace: o.value })} />
          ))}
        </div>
      </Sect>
      {config.necklace !== 'none' && (
        <Sect label="Necklace Color">
          <div className="flex flex-wrap gap-2">
            {NECKLACE_COLORS.map(c => (
              <ColorSwatch key={c.value} color={c.value} selected={config.necklaceColor === c.value}
                onClick={() => update({ necklaceColor: c.value })} title={c.name} />
            ))}
          </div>
        </Sect>
      )}
    </div>
  );

  const contentMap: Record<GuidedStep, React.ReactNode> = {
    face: faceContent,
    hair: hairContent,
    body: bodyContent,
    accessories: accessoriesContent,
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

        <div className="mt-6 w-full">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500 font-medium">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
            <span className="text-xs text-sky-400 font-semibold">{currentStep.label}</span>
          </div>
          <div className="flex gap-1.5 mb-5">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStepIndex(i)}
                className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                  i <= stepIndex ? 'bg-sky-500' : 'bg-white/10'
                }`}
                title={s.label}
              />
            ))}
          </div>

          <p className="text-xs text-gray-500 text-center mb-4">{currentStep.description}</p>

          <button
            onClick={onSwitchToAdvanced}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
              text-xs text-gray-400 hover:text-gray-200 border border-white/10
              hover:border-white/20 hover:bg-white/5 transition-all"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Switch to Advanced Mode
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-[#080d14]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-white">{currentStep.label}</h3>
            <p className="text-xs text-gray-500">{currentStep.description}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStepIndex(i => i - 1)}
              disabled={!canGoBack}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-white/5 border border-white/10 text-gray-400
                hover:bg-white/10 hover:text-white transition-all
                disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <button
              onClick={() => setStepIndex(i => i + 1)}
              disabled={!canGoNext}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold
                bg-sky-600 hover:bg-sky-500 border border-sky-500 text-white
                transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {contentMap[currentStep.id]}
        </div>
      </div>
    </div>
  );
}
