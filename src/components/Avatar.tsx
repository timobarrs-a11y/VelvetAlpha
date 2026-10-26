import { AvatarConfig } from '../types/avatar';
import { AvatarConfigV2 } from '../types/avatar-v2';
import { AvatarV2 } from './AvatarV2';

interface AvatarProps {
  // Older v1 configs and current ones both draw with the current renderer.
  config: AvatarConfig | Partial<AvatarConfigV2>;
  className?: string;
}

export function Avatar({ config, className = '' }: AvatarProps) {
  return <AvatarV2 config={config as Partial<AvatarConfigV2>} className={className} />;
}
