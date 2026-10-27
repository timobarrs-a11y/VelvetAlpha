import { Avatar } from '../../components/Avatar';
import { DEFAULT_MALE_AVATAR_V2, type AvatarConfigV2 } from '../../types/avatar-v2';
import type { QuestionnaireHost } from './HostDialogue';

/**
 * Dez Dupree: the mayor of Town, who also moves everybody in and runs the deliveries (he first shows
 * up in Velvet Sims). He is the one who welcomes new neighbors, so he asks the arrival questions.
 * A cowboy hat, a rust shirt, jeans, and the mustache he got from his granddaddy.
 */
export const DEZ_LOOK: AvatarConfigV2 = {
  ...DEFAULT_MALE_AVATAR_V2,
  skinTone: '#c69b6e',
  hairColor: '#3d2817',
  hairStyle: 'short',
  eyeColor: '#3b2416',
  facialHair: 'mustache',
  bodyType: 'average',
  outfit: 'tee',
  outfitColor: '#B5523B',
  bottom: 'jeans',
  bottomColor: '#3D5B8A',
  headwear: 'cowboy_hat',
};

export const DEZ: QuestionnaireHost = {
  name: 'Dez',
  title: 'Mayor of Town',
  portrait: <Avatar config={DEZ_LOOK} className="h-full w-full" />,
};
