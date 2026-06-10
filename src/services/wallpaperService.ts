import { supabase } from '../shared/supabase/client';

export interface WallpaperPreset {
  id: string;
  name: string;
  thumbnail: string;
  type: 'css' | 'photo' | 'live';
  cssStyle?: React.CSSProperties;
  photoUrl?: string;
  liveClass?: string;
  thumbnailStyle?: React.CSSProperties;
}

export const CSS_WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'aurora-night',
    name: 'Aurora Night',
    thumbnail: '',
    type: 'css',
    cssStyle: {
      background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 40%, #24243e 70%, #0f4c35 100%)',
    },
  },
  {
    id: 'sunset-dusk',
    name: 'Sunset Dusk',
    thumbnail: '',
    type: 'css',
    cssStyle: {
      background: 'linear-gradient(160deg, #f97316 0%, #ec4899 35%, #8b5cf6 65%, #1e1b4b 100%)',
    },
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    thumbnail: '',
    type: 'css',
    cssStyle: {
      background: 'linear-gradient(180deg, #0ea5e9 0%, #0369a1 30%, #075985 60%, #0c1445 100%)',
    },
  },
  {
    id: 'cherry-blossom',
    name: 'Cherry Blossom',
    thumbnail: '',
    type: 'css',
    cssStyle: {
      background: 'linear-gradient(145deg, #fdf2f8 0%, #fce7f3 25%, #fbcfe8 50%, #f9a8d4 75%, #f472b6 100%)',
    },
  },
  {
    id: 'midnight-city',
    name: 'Midnight City',
    thumbnail: '',
    type: 'css',
    cssStyle: {
      background: 'linear-gradient(180deg, #0d1117 0%, #161b22 40%, #1c2128 70%, #21262d 100%)',
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    thumbnail: '',
    type: 'css',
    cssStyle: {
      background: 'linear-gradient(155deg, #fbbf24 0%, #f59e0b 20%, #ef4444 50%, #b91c1c 80%, #7c2d12 100%)',
    },
  },
  {
    id: 'forest-mist',
    name: 'Forest Mist',
    thumbnail: '',
    type: 'css',
    cssStyle: {
      background: 'linear-gradient(160deg, #d1fae5 0%, #6ee7b7 25%, #34d399 50%, #059669 75%, #064e3b 100%)',
    },
  },
  {
    id: 'rose-garden',
    name: 'Rose Garden',
    thumbnail: '',
    type: 'css',
    cssStyle: {
      background: 'linear-gradient(145deg, #fff1f2 0%, #ffe4e6 20%, #fecdd3 45%, #fb7185 70%, #e11d48 100%)',
    },
  },
  {
    id: 'arctic-ice',
    name: 'Arctic Ice',
    thumbnail: '',
    type: 'css',
    cssStyle: {
      background: 'linear-gradient(160deg, #f0f9ff 0%, #e0f2fe 25%, #bae6fd 50%, #7dd3fc 75%, #38bdf8 100%)',
    },
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    thumbnail: '',
    type: 'css',
    cssStyle: {
      background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 35%, #0f3460 65%, #533483 100%)',
    },
  },
];

export const PHOTO_WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'photo-beach',
    name: 'Tropical Beach',
    thumbnail: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&fit=crop',
    type: 'photo',
    photoUrl: 'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  },
  {
    id: 'photo-mountains',
    name: 'Mountain Peaks',
    thumbnail: 'https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&fit=crop',
    type: 'photo',
    photoUrl: 'https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  },
  {
    id: 'photo-city-night',
    name: 'City at Night',
    thumbnail: 'https://images.pexels.com/photos/315191/pexels-photo-315191.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&fit=crop',
    type: 'photo',
    photoUrl: 'https://images.pexels.com/photos/315191/pexels-photo-315191.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  },
  {
    id: 'photo-forest',
    name: 'Enchanted Forest',
    thumbnail: 'https://images.pexels.com/photos/167698/pexels-photo-167698.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&fit=crop',
    type: 'photo',
    photoUrl: 'https://images.pexels.com/photos/167698/pexels-photo-167698.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  },
  {
    id: 'photo-starry-sky',
    name: 'Starry Sky',
    thumbnail: 'https://images.pexels.com/photos/1252869/pexels-photo-1252869.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&fit=crop',
    type: 'photo',
    photoUrl: 'https://images.pexels.com/photos/1252869/pexels-photo-1252869.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  },
  {
    id: 'photo-cherry-blossoms',
    name: 'Cherry Blossoms',
    thumbnail: 'https://images.pexels.com/photos/931177/pexels-photo-931177.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&fit=crop',
    type: 'photo',
    photoUrl: 'https://images.pexels.com/photos/931177/pexels-photo-931177.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  },
  {
    id: 'photo-desert-dunes',
    name: 'Desert Dunes',
    thumbnail: 'https://images.pexels.com/photos/618833/pexels-photo-618833.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&fit=crop',
    type: 'photo',
    photoUrl: 'https://images.pexels.com/photos/618833/pexels-photo-618833.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  },
  {
    id: 'photo-rainy-cafe',
    name: 'Rainy Cafe',
    thumbnail: 'https://images.pexels.com/photos/1813466/pexels-photo-1813466.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&fit=crop',
    type: 'photo',
    photoUrl: 'https://images.pexels.com/photos/1813466/pexels-photo-1813466.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  },
  {
    id: 'photo-northern-lights',
    name: 'Northern Lights',
    thumbnail: 'https://images.pexels.com/photos/1933239/pexels-photo-1933239.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&fit=crop',
    type: 'photo',
    photoUrl: 'https://images.pexels.com/photos/1933239/pexels-photo-1933239.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  },
  {
    id: 'photo-ocean-sunset',
    name: 'Ocean Sunset',
    thumbnail: 'https://images.pexels.com/photos/1033729/pexels-photo-1033729.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&fit=crop',
    type: 'photo',
    photoUrl: 'https://images.pexels.com/photos/1033729/pexels-photo-1033729.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop',
  },
];

export const LIVE_WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'live-aurora',
    name: 'Northern Aurora',
    thumbnail: '',
    type: 'live',
    liveClass: 'lw-aurora',
    thumbnailStyle: { background: 'linear-gradient(135deg, #0d1b2a 0%, #1a3a2a 35%, #0a2e4a 65%, #1e1040 100%)' },
  },
  {
    id: 'live-sunset',
    name: 'Living Sunset',
    thumbnail: '',
    type: 'live',
    liveClass: 'lw-sunset',
    thumbnailStyle: { background: 'linear-gradient(135deg, #ff6b35 0%, #e94560 50%, #1a1a2e 100%)' },
  },
  {
    id: 'live-ocean',
    name: 'Deep Ocean',
    thumbnail: '',
    type: 'live',
    liveClass: 'lw-ocean',
    thumbnailStyle: { background: 'linear-gradient(135deg, #0c1e3c 0%, #1a7a9a 50%, #0e4d6b 100%)' },
  },
  {
    id: 'live-neon',
    name: 'Neon Pulse',
    thumbnail: '',
    type: 'live',
    liveClass: 'lw-neon',
    thumbnailStyle: { background: 'linear-gradient(135deg, #0d0d0d 0%, #1a0030 35%, #003030 65%, #200040 100%)' },
  },
  {
    id: 'live-embers',
    name: 'Ember Glow',
    thumbnail: '',
    type: 'live',
    liveClass: 'lw-embers',
    thumbnailStyle: { background: 'linear-gradient(135deg, #1a0500 0%, #8b2500 50%, #5a1500 100%)' },
  },
  {
    id: 'live-cherry',
    name: 'Cherry Drift',
    thumbnail: '',
    type: 'live',
    liveClass: 'lw-cherry',
    thumbnailStyle: { background: 'linear-gradient(135deg, #fff0f5 0%, #ffb3cc 50%, #ff8fb0 100%)' },
  },
  {
    id: 'live-midnight',
    name: 'Midnight Void',
    thumbnail: '',
    type: 'live',
    liveClass: 'lw-midnight',
    thumbnailStyle: { background: 'linear-gradient(135deg, #000510 0%, #0a0a20 50%, #050520 100%)' },
  },
  {
    id: 'live-forest',
    name: 'Forest Breath',
    thumbnail: '',
    type: 'live',
    liveClass: 'lw-forest',
    thumbnailStyle: { background: 'linear-gradient(135deg, #0a1a0a 0%, #1a3a1a 50%, #153015 100%)' },
  },
  {
    id: 'live-galaxy',
    name: 'Galaxy Drift',
    thumbnail: '',
    type: 'live',
    liveClass: 'lw-galaxy',
    thumbnailStyle: { background: 'linear-gradient(135deg, #060010 0%, #15002a 40%, #1a0030 100%)' },
  },
  {
    id: 'live-desert',
    name: 'Desert Heat',
    thumbnail: '',
    type: 'live',
    liveClass: 'lw-desert',
    thumbnailStyle: { background: 'linear-gradient(135deg, #3d1c00 0%, #c46200 50%, #7a3b00 100%)' },
  },
  {
    id: 'live-ice',
    name: 'Arctic Ice',
    thumbnail: '',
    type: 'live',
    liveClass: 'lw-ice',
    thumbnailStyle: { background: 'linear-gradient(135deg, #e8f4fd 0%, #a8daef 50%, #c5e8f9 100%)' },
  },
  {
    id: 'live-rose-gold',
    name: 'Rose Gold',
    thumbnail: '',
    type: 'live',
    liveClass: 'lw-rose-gold',
    thumbnailStyle: { background: 'linear-gradient(135deg, #3d1a20 0%, #c06070 50%, #7a3040 100%)' },
  },
];

export const ALL_PRESETS = [...CSS_WALLPAPER_PRESETS, ...PHOTO_WALLPAPER_PRESETS, ...LIVE_WALLPAPER_PRESETS];

export function getPresetById(id: string): WallpaperPreset | undefined {
  return ALL_PRESETS.find(p => p.id === id);
}

export function buildWallpaperStyle(
  wallpaperId: string | null | undefined,
  wallpaperUrl: string | null | undefined
): React.CSSProperties {
  if (!wallpaperId) return {};

  if (wallpaperId === 'custom' && wallpaperUrl) {
    return {
      backgroundImage: `url(${wallpaperUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }

  const preset = getPresetById(wallpaperId);
  if (!preset) return {};

  if (preset.type === 'live') {
    return {};
  }

  if (preset.type === 'css' && preset.cssStyle) {
    return preset.cssStyle;
  }

  if (preset.type === 'photo' && preset.photoUrl) {
    return {
      backgroundImage: `url(${preset.photoUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }

  return {};
}

export function buildWallpaperMeta(
  wallpaperId: string | null | undefined,
  wallpaperUrl: string | null | undefined
): { style: React.CSSProperties; className: string } {
  if (!wallpaperId) return { style: {}, className: '' };

  const preset = getPresetById(wallpaperId);
  if (preset?.type === 'live' && preset.liveClass) {
    return { style: {}, className: preset.liveClass };
  }

  return { style: buildWallpaperStyle(wallpaperId, wallpaperUrl), className: '' };
}

export async function saveCompanionWallpaper(
  companionId: string,
  wallpaperId: string | null,
  wallpaperUrl: string | null = null
): Promise<void> {
  const { error } = await supabase
    .from('companions')
    .update({
      chat_wallpaper: wallpaperId,
      chat_wallpaper_url: wallpaperUrl,
    })
    .eq('id', companionId);

  if (error) throw new Error(error.message);
}

export async function uploadWallpaperImage(
  userId: string,
  companionId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `wallpapers/${userId}/${companionId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('chat-wallpapers')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from('chat-wallpapers').getPublicUrl(path);
  return data.publicUrl;
}

export async function generateAIWallpaper(
  companionId: string,
  prompt: string,
  companionName: string
): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(
    `${supabaseUrl}/functions/v1/generate-wallpaper`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ companionId, prompt, companionName }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to generate wallpaper');
  }

  const data = await response.json();
  return data.imageUrl as string;
}
