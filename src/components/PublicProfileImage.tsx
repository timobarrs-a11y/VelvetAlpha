import { Avatar } from './Avatar';
import { smilieUrl } from '../config/smilieRegistry';
import { migrateAvatarConfig } from '../utils/avatarConfig';
import type { AvatarConfigV2 } from '../types/avatar-v2';
import type { MemberProfile } from '../services/memberProfileService';

interface PublicProfileImageProps {
  profile: Pick<MemberProfile, 'avatar_config' | 'profile_image_type' | 'profile_smilie_code'>;
  className?: string;
  imageClassName?: string;
}

export function PublicProfileImage({ profile, className = '', imageClassName = '' }: PublicProfileImageProps) {
  const smiley = profile.profile_image_type === 'smilie' && profile.profile_smilie_code
    ? smilieUrl(profile.profile_smilie_code)
    : null;

  if (smiley) {
    return (
      <div className={`flex items-center justify-center bg-white/5 ${className}`}>
        <img src={smiley} alt="Public profile smiley" className={`max-h-full max-w-full object-contain ${imageClassName}`} />
      </div>
    );
  }

  const avatarConfig = profile.avatar_config ? migrateAvatarConfig(profile.avatar_config) : null;
  if (avatarConfig) {
    return <Avatar config={avatarConfig as AvatarConfigV2} className={`${className} ${imageClassName}`} />;
  }

  return <div className={`flex items-center justify-center bg-white/5 ${className}`} />;
}
