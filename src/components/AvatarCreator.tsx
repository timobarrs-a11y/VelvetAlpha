import { useState } from 'react';
import { Avatar } from './Avatar';
import {
  AvatarConfig,
  Gender,
  SKIN_TONES,
  EYE_COLORS,
  HAIR_COLORS,
  LIP_COLORS,
  NECKLACE_COLORS,
  MALE_HAIRSTYLES,
  FEMALE_HAIRSTYLES,
  LipShape,
  EyebrowShape,
  FacialHair,
  Eyelashes,
  Freckles,
  Glasses,
  Earrings,
  NosePiercing,
  LipPiercing,
  Necklace
} from '../types/avatar';

interface AvatarCreatorProps {
  initialConfig: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
  showGenderSelector?: boolean;
}

export function AvatarCreator({ initialConfig, onChange, showGenderSelector = true }: AvatarCreatorProps) {
  const [config, setConfig] = useState<AvatarConfig>(initialConfig);

  const updateConfig = (updates: Partial<AvatarConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange(newConfig);
  };

  const hairstyles = config.gender === 'male' ? MALE_HAIRSTYLES : FEMALE_HAIRSTYLES;

  const lipShapes: Array<{ value: LipShape; label: string }> = [
    { value: 'natural', label: 'Natural' },
    { value: 'full', label: 'Full' },
    { value: 'thin', label: 'Thin' },
    { value: 'heart', label: 'Heart' }
  ];

  const eyebrowShapes: Array<{ value: EyebrowShape; label: string }> = [
    { value: 'natural', label: 'Natural' },
    { value: 'arched', label: 'Arched' },
    { value: 'straight', label: 'Straight' },
    { value: 'thick', label: 'Thick' },
    { value: 'thin', label: 'Thin' }
  ];

  const facialHairOptions: Array<{ value: FacialHair; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'stubble', label: 'Stubble' },
    { value: 'beard', label: 'Beard' },
    { value: 'goatee', label: 'Goatee' },
    { value: 'mustache', label: 'Mustache' }
  ];

  const eyelashOptions: Array<{ value: Eyelashes; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'dramatic', label: 'Dramatic' }
  ];

  const freckleOptions: Array<{ value: Freckles; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'light', label: 'Light' },
    { value: 'heavy', label: 'Heavy' },
    { value: 'beauty_mark', label: 'Beauty Mark' }
  ];

  const glassesOptions: Array<{ value: Glasses; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'round', label: 'Round' },
    { value: 'square', label: 'Square' },
    { value: 'cat-eye', label: 'Cat-Eye' },
    { value: 'aviator', label: 'Aviator' }
  ];

  const earringOptions: Array<{ value: Earrings; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'studs', label: 'Studs' },
    { value: 'hoops', label: 'Hoops' },
    { value: 'dangles', label: 'Dangles' },
    { value: 'gauges', label: 'Gauges' }
  ];

  const nosePiercingOptions: Array<{ value: NosePiercing; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'nostril_stud', label: 'Nostril Stud' },
    { value: 'nose_ring', label: 'Nose Ring' }
  ];

  const lipPiercingOptions: Array<{ value: LipPiercing; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'labret', label: 'Labret' },
    { value: 'lip_ring', label: 'Lip Ring' },
    { value: 'snake_bites', label: 'Snake Bites' }
  ];

  const necklaceOptions: Array<{ value: Necklace; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'chain', label: 'Chain' },
    { value: 'choker', label: 'Choker' },
    { value: 'pendant', label: 'Pendant' },
    { value: 'pearls', label: 'Pearls' }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="flex items-center justify-center bg-gray-800 rounded-xl p-8">
        <div className="w-64 h-64 flex items-center justify-center">
          <Avatar config={config} className="w-full h-full" />
        </div>
      </div>

      <div className="space-y-6 max-h-[600px] overflow-y-auto pr-4">
        {showGenderSelector && (
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">Gender</label>
            <div className="grid grid-cols-2 gap-3">
              {(['male', 'female'] as Gender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => updateConfig({
                    gender: g,
                    hairStyle: g === 'male' ? 'short' : 'sleek',
                    facialHair: 'none',
                    eyelashes: 'none'
                  })}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    config.gender === g
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Skin Tone</label>
          <div className="grid grid-cols-6 gap-2">
            {SKIN_TONES.map((tone) => (
              <button
                key={tone.value}
                onClick={() => updateConfig({ skinTone: tone.value })}
                className={`w-12 h-12 rounded-full border-2 transition-all ${
                  config.skinTone === tone.value
                    ? 'border-blue-500 ring-2 ring-blue-400'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
                style={{ backgroundColor: tone.value }}
                title={tone.name}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Eye Color</label>
          <div className="grid grid-cols-6 gap-2">
            {EYE_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => updateConfig({ eyeColor: color.value })}
                className={`w-12 h-12 rounded-full border-2 transition-all ${
                  config.eyeColor === color.value
                    ? 'border-blue-500 ring-2 ring-blue-400'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Hair Color</label>
          <div className="grid grid-cols-5 gap-2">
            {HAIR_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => updateConfig({ hairColor: color.value })}
                className={`w-12 h-12 rounded-full border-2 transition-all ${
                  config.hairColor === color.value
                    ? 'border-blue-500 ring-2 ring-blue-400'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Hairstyle</label>
          <div className="grid grid-cols-3 gap-2">
            {hairstyles.map((style) => (
              <button
                key={style.value}
                onClick={() => updateConfig({ hairStyle: style.value as any })}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  config.hairStyle === style.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Lip Color</label>
          <div className="grid grid-cols-7 gap-2">
            {LIP_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => updateConfig({ lipColor: color.value })}
                className={`w-12 h-12 rounded-full border-2 transition-all ${
                  config.lipColor === color.value
                    ? 'border-blue-500 ring-2 ring-blue-400'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Lip Shape</label>
          <div className="grid grid-cols-4 gap-2">
            {lipShapes.map((shape) => (
              <button
                key={shape.value}
                onClick={() => updateConfig({ lipShape: shape.value })}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  config.lipShape === shape.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {shape.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Eyebrows</label>
          <div className="grid grid-cols-3 gap-2">
            {eyebrowShapes.map((shape) => (
              <button
                key={shape.value}
                onClick={() => updateConfig({ eyebrowShape: shape.value })}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  config.eyebrowShape === shape.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {shape.label}
              </button>
            ))}
          </div>
        </div>

        {config.gender === 'male' && (
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">Facial Hair</label>
            <div className="grid grid-cols-3 gap-2">
              {facialHairOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateConfig({ facialHair: option.value })}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                    config.facialHair === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {config.gender === 'female' && (
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">Eyelashes</label>
            <div className="grid grid-cols-2 gap-2">
              {eyelashOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateConfig({ eyelashes: option.value })}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                    config.eyelashes === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Freckles</label>
          <div className="grid grid-cols-4 gap-2">
            {freckleOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updateConfig({ freckles: option.value })}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  config.freckles === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Glasses</label>
          <div className="grid grid-cols-3 gap-2">
            {glassesOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updateConfig({ glasses: option.value })}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  config.glasses === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Earrings</label>
          <div className="grid grid-cols-3 gap-2">
            {earringOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updateConfig({ earrings: option.value })}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  config.earrings === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Nose Piercing</label>
          <div className="grid grid-cols-2 gap-2">
            {nosePiercingOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updateConfig({ nosePiercing: option.value })}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  config.nosePiercing === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Lip Piercing</label>
          <div className="grid grid-cols-2 gap-2">
            {lipPiercingOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updateConfig({ lipPiercing: option.value })}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  config.lipPiercing === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Necklace</label>
          <div className="grid grid-cols-3 gap-2">
            {necklaceOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updateConfig({ necklace: option.value })}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  config.necklace === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {config.necklace !== 'none' && (
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">Necklace Color</label>
            <div className="grid grid-cols-3 gap-2">
              {NECKLACE_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateConfig({ necklaceColor: color.value })}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition-all border-2 ${
                    config.necklaceColor === color.value
                      ? 'border-blue-500 bg-gray-700'
                      : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border border-gray-500"
                      style={{ backgroundColor: color.value }}
                    />
                    <span className="text-gray-200">{color.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
