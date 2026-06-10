import { supabase } from '../shared/supabase/client';

export interface PointerSymbol {
  key: string;
  label: string;
  svg: string;
  unlockDay: number;
  unlockLabel: string;
}

export const POINTER_SYMBOLS: PointerSymbol[] = [
  {
    key: 'star',
    label: 'Star',
    svg: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    unlockDay: 0,
    unlockLabel: 'Default',
  },
  {
    key: 'heart',
    label: 'Heart',
    svg: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
    unlockDay: 0,
    unlockLabel: 'Default',
  },
  {
    key: 'sparkle',
    svg: 'M12 3l1.5 4.5 4.5 1.5-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 2l.75 2.25L8 5l-2.25.75L5 8l-.75-2.25L2 5l2.25-.75L5 2zM19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z',
    label: 'Sparkle',
    unlockDay: 0,
    unlockLabel: 'Default',
  },
  {
    key: 'moon',
    label: 'Moon',
    svg: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
    unlockDay: 0,
    unlockLabel: 'Default',
  },
  {
    key: 'crown',
    label: 'Crown',
    svg: 'M2 20h20M5 20V8l7-5 7 5v12M9 20v-5a3 3 0 0 1 6 0v5',
    unlockDay: 0,
    unlockLabel: 'Default',
  },
];

export interface CursorColorOption {
  key: string;
  label: string;
  primary: string;
  particles: string[];
  unlockDay: number;
  unlockLabel: string;
}

export const CURSOR_COLOR_OPTIONS: CursorColorOption[] = [
  {
    key: 'rose',
    label: 'Rose',
    primary: 'rgba(244, 63, 107, 0.85)',
    particles: ['#f43f6b', '#fb7185', '#fda4af', '#e11d48'],
    unlockDay: 0,
    unlockLabel: 'Default',
  },
  {
    key: 'sky',
    label: 'Sky',
    primary: 'rgba(56, 189, 248, 0.85)',
    particles: ['#38bdf8', '#7dd3fc', '#bae6fd', '#0284c7'],
    unlockDay: 0,
    unlockLabel: 'Default',
  },
  {
    key: 'emerald',
    label: 'Emerald',
    primary: 'rgba(52, 211, 153, 0.85)',
    particles: ['#34d399', '#6ee7b7', '#a7f3d0', '#059669'],
    unlockDay: 0,
    unlockLabel: 'Default',
  },
  {
    key: 'amber',
    label: 'Amber',
    primary: 'rgba(251, 191, 36, 0.85)',
    particles: ['#fbbf24', '#fcd34d', '#fde68a', '#d97706'],
    unlockDay: 0,
    unlockLabel: 'Default',
  },
  {
    key: 'violet',
    label: 'Violet',
    primary: 'rgba(167, 139, 250, 0.85)',
    particles: ['#a78bfa', '#c4b5fd', '#ddd6fe', '#7c3aed'],
    unlockDay: 0,
    unlockLabel: 'Default',
  },
  {
    key: 'gold',
    label: 'Gold',
    primary: 'rgba(255, 215, 0, 0.90)',
    particles: ['#ffd700', '#ffec6e', '#fff4a3', '#b8860b'],
    unlockDay: 0,
    unlockLabel: 'Default',
  },
  {
    key: 'aurora',
    label: 'Aurora',
    primary: 'rgba(110, 231, 183, 0.85)',
    particles: ['#6ee7b7', '#818cf8', '#f43f6b', '#38bdf8'],
    unlockDay: 0,
    unlockLabel: 'Default',
  },
];

export interface AnimationStyle {
  key: string;
  label: string;
  description: string;
  unlockDay: number;
  unlockLabel: string;
  icon: string;
}

export const ANIMATION_STYLES: AnimationStyle[] = [
  { key: 'none',      label: 'None',      description: 'Clean — no particles',              unlockDay: 0,  unlockLabel: 'Default',       icon: 'M18.36 6.64a9 9 0 1 1-12.73 0' },
  { key: 'stars',     label: 'Stars',     description: 'Twinkling stars burst out',          unlockDay: 0,  unlockLabel: 'Default',       icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  { key: 'bubbles',   label: 'Bubbles',   description: 'Soft glowing orbs float up',         unlockDay: 0,  unlockLabel: 'Default',       icon: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z' },
  { key: 'petals',    label: 'Petals',    description: 'Cherry blossom petals drift',         unlockDay: 0,  unlockLabel: 'Default',       icon: 'M12 3c-4.8 4.8-4.8 12.6 0 17.4 4.8-4.8 4.8-12.6 0-17.4z' },
  { key: 'sparks',    label: 'Sparks',    description: 'Electric sparks crackle',             unlockDay: 0,  unlockLabel: 'Default',       icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  { key: 'comet',     label: 'Comet',     description: 'A long luminous comet tail',          unlockDay: 0,  unlockLabel: 'Default',       icon: 'M5 3l14 9-14 9V3z' },
  { key: 'confetti',  label: 'Confetti',  description: 'Colourful flat rectangles tumble',   unlockDay: 0,  unlockLabel: 'Default',       icon: 'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 0-2-2v-4m0 0h18' },
  { key: 'snow',      label: 'Snow',      description: 'Soft snowflakes drift down',         unlockDay: 0,  unlockLabel: 'Default',       icon: 'M12 2v20M4.93 4.93l14.14 14.14M2 12h20M4.93 19.07 19.07 4.93' },
  { key: 'lightning', label: 'Lightning', description: 'Jagged electric bolts shoot out',   unlockDay: 0,  unlockLabel: 'Default',       icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' },
  { key: 'fireworks', label: 'Fireworks', description: 'Radial bursts explode outward',     unlockDay: 0,  unlockLabel: 'Default',       icon: 'M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z' },
];

export interface TrailStyle {
  key: string;
  label: string;
  description: string;
  unlockDay: number;
  unlockLabel: string;
}

export const TRAIL_STYLES: TrailStyle[] = [
  { key: 'solid',    label: 'Glow',     description: 'Classic glowing path',           unlockDay: 0,  unlockLabel: 'Default'       },
  { key: 'dots',     label: 'Dots',     description: 'Spaced glowing circles',         unlockDay: 0,  unlockLabel: 'Default'       },
  { key: 'dashes',   label: 'Dashes',   description: 'Sharp dashed strokes',           unlockDay: 0,  unlockLabel: 'Default' },
  { key: 'neon',     label: 'Neon',     description: 'Thick bright neon tube',         unlockDay: 0,  unlockLabel: 'Default' },
  { key: 'rainbow',  label: 'Rainbow',  description: 'Full hue-shifting spectrum',     unlockDay: 0,  unlockLabel: 'Default' },
  { key: 'pulse',    label: 'Pulse',    description: 'Rhythmic swelling wave line',    unlockDay: 0,  unlockLabel: 'Default' },
];

export type FontGender = 'feminine' | 'masculine' | 'neutral';

export interface FontOption {
  key: string;
  label: string;
  fontFamily: string;
  gender: FontGender;
  sample: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { key: 'cormorant',        label: 'Cormorant',        fontFamily: "'Cormorant Garamond', serif",         gender: 'feminine',  sample: 'Elegant & refined' },
  { key: 'playfair',         label: 'Playfair',         fontFamily: "'Playfair Display', serif",           gender: 'feminine',  sample: 'Timeless beauty' },
  { key: 'lora',             label: 'Lora',             fontFamily: "'Lora', serif",                       gender: 'feminine',  sample: 'Warm & literary' },
  { key: 'dm_serif',         label: 'DM Serif',         fontFamily: "'DM Serif Display', serif",           gender: 'feminine',  sample: 'Soft & expressive' },
  { key: 'libre_bodoni',     label: 'Libre Bodoni',     fontFamily: "'Libre Bodoni', serif",               gender: 'feminine',  sample: 'Classic editorial' },
  { key: 'josefin_slab',     label: 'Josefin Slab',     fontFamily: "'Josefin Slab', serif",               gender: 'feminine',  sample: 'Chic & geometric' },
  { key: 'oswald',           label: 'Oswald',           fontFamily: "'Oswald', sans-serif",                gender: 'masculine', sample: 'Bold & structured' },
  { key: 'barlow',           label: 'Barlow',           fontFamily: "'Barlow', sans-serif",                gender: 'masculine', sample: 'Clean & confident' },
  { key: 'exo2',             label: 'Exo 2',            fontFamily: "'Exo 2', sans-serif",                 gender: 'masculine', sample: 'Futuristic & sharp' },
  { key: 'libre_baskerville',label: 'Libre Baskerville',fontFamily: "'Libre Baskerville', serif",          gender: 'masculine', sample: 'Grounded & classic' },
  { key: 'chakra_petch',     label: 'Chakra Petch',     fontFamily: "'Chakra Petch', sans-serif",          gender: 'masculine', sample: 'Technical & direct' },
  { key: 'arvo',             label: 'Arvo',             fontFamily: "'Arvo', serif",                       gender: 'masculine', sample: 'Solid & dependable' },
  { key: 'nunito',           label: 'Nunito',           fontFamily: "'Nunito', sans-serif",                gender: 'neutral',   sample: 'Friendly & round' },
  { key: 'raleway',          label: 'Raleway',          fontFamily: "'Raleway', sans-serif",               gender: 'neutral',   sample: 'Sleek & minimal' },
  { key: 'quicksand',        label: 'Quicksand',        fontFamily: "'Quicksand', sans-serif",             gender: 'neutral',   sample: 'Light & airy' },
  { key: 'mulish',           label: 'Mulish',           fontFamily: "'Mulish', sans-serif",                gender: 'neutral',   sample: 'Modern & versatile' },
  { key: 'karla',            label: 'Karla',            fontFamily: "'Karla', sans-serif",                 gender: 'neutral',   sample: 'Clean & approachable' },
  { key: 'outfit',           label: 'Outfit',           fontFamily: "'Outfit', sans-serif",                gender: 'neutral',   sample: 'Contemporary & crisp' },
  { key: 'manrope',          label: 'Manrope',          fontFamily: "'Manrope', sans-serif",               gender: 'neutral',   sample: 'Geometric & balanced' },
  { key: 'space_grotesk',    label: 'Space Grotesk',    fontFamily: "'Space Grotesk', sans-serif",         gender: 'neutral',   sample: 'Distinctive & techy' },
  // Fun / expressive fonts
  { key: 'comic_sans',       label: 'Comic Sans',        fontFamily: "'Comic Sans MS', 'Comic Sans', cursive", gender: 'neutral',  sample: 'Playful & casual' },
  { key: 'courier',          label: 'Courier',           fontFamily: "'Courier New', Courier, monospace",      gender: 'neutral',  sample: 'Typewriter & retro' },
  { key: 'georgia',          label: 'Georgia',           fontFamily: "Georgia, 'Times New Roman', serif",      gender: 'neutral',  sample: 'Classic & literary' },
  { key: 'trebuchet',        label: 'Trebuchet',         fontFamily: "'Trebuchet MS', Helvetica, sans-serif",  gender: 'neutral',  sample: 'Clean & humanist' },
  { key: 'impact',           label: 'Impact',            fontFamily: "Impact, 'Arial Black', sans-serif",      gender: 'neutral',  sample: 'Bold & striking' },
];

export function getEligibleFonts(gender: 'male' | 'female'): FontOption[] {
  if (gender === 'female') {
    return FONT_OPTIONS.filter(f => f.gender === 'feminine' || f.gender === 'neutral');
  }
  return FONT_OPTIONS.filter(f => f.gender === 'masculine' || f.gender === 'neutral');
}

export function getFontByKey(key: string): FontOption | undefined {
  return FONT_OPTIONS.find(f => f.key === key);
}

export interface ButtonHoverStyle {
  key: string;
  label: string;
  description: string;
  unlockDay: number;
  unlockLabel: string;
  icon: string;
}

export const BUTTON_HOVER_STYLES: ButtonHoverStyle[] = [
  {
    key: 'none',
    label: 'None',
    description: 'No button hover effect',
    unlockDay: 0,
    unlockLabel: 'Default',
    icon: 'M18.36 6.64a9 9 0 1 1-12.73 0',
  },
  {
    key: 'portal',
    label: 'Portal',
    description: 'Spiral vortex drains into center',
    unlockDay: 0,
    unlockLabel: 'Default',
    icon: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 4a6 6 0 1 1 0 12A6 6 0 0 1 12 6zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  },
  {
    key: 'ripple',
    label: 'Ripple',
    description: 'Concentric pulse rings expand out',
    unlockDay: 0,
    unlockLabel: 'Default',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z',
  },
  {
    key: 'aurora',
    label: 'Aurora',
    description: 'Shifting color bands sweep across',
    unlockDay: 0,
    unlockLabel: 'Default',
    icon: 'M3 12h18M3 6h18M3 18h18',
  },
  {
    key: 'sparks',
    label: 'Sparks',
    description: 'Electric sparks arc from edges',
    unlockDay: 0,
    unlockLabel: 'Default',
    icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  },
  {
    key: 'ember',
    label: 'Ember',
    description: 'Glowing embers drift up from edges',
    unlockDay: 0,
    unlockLabel: 'Default',
    icon: 'M12 2c0 6-6 8-6 14a6 6 0 0 0 12 0c0-6-6-8-6-14zm0 17a2 2 0 0 1-2-2c0-2 2-3.5 2-3.5s2 1.5 2 3.5a2 2 0 0 1-2 2z',
  },
];

export interface UserCustomization {
  active_pointer: string;
  unlocked_pointers: string[];
  tile_colors: Record<string, string>;
  current_streak: number;
  longest_streak: number;
  total_checkins: number;
  show_trail: boolean;
  trail_style: string;
  animation_style: string;
  cursor_color: string;
  font_customization_unlocked: boolean;
  button_hover_style: string;
  translucent_ui: boolean;
  left_rail_collapsed: boolean;
}

const DEFAULT_CUSTOMIZATION: UserCustomization = {
  active_pointer:              'star',
  unlocked_pointers:           ['star'],
  tile_colors:                 {},
  current_streak:              0,
  longest_streak:              0,
  total_checkins:              0,
  show_trail:                  false,
  trail_style:                 'solid',
  animation_style:             'stars',
  cursor_color:                'rose',
  font_customization_unlocked: false,
  button_hover_style:          'none',
  translucent_ui:              false,
  left_rail_collapsed:         false,
};

export async function getDailyCheckinStatus(userId: string): Promise<{
  alreadyCheckedIn: boolean;
  customization: UserCustomization;
}> {
  const today = new Date().toISOString().split('T')[0];

  const [{ data: checkin }, { data: customRow }] = await Promise.all([
    supabase
      .from('user_daily_checkins')
      .select('id')
      .eq('user_id', userId)
      .eq('checkin_date', today)
      .maybeSingle(),
    supabase
      .from('user_customization')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const customization: UserCustomization = customRow
    ? {
        active_pointer:              customRow.active_pointer,
        unlocked_pointers:           customRow.unlocked_pointers,
        tile_colors:                 customRow.tile_colors,
        current_streak:              customRow.current_streak,
        longest_streak:              customRow.longest_streak,
        total_checkins:              customRow.total_checkins,
        show_trail:                  customRow.show_trail ?? false,
        trail_style:                 customRow.trail_style ?? 'solid',
        animation_style:             customRow.animation_style ?? 'stars',
        cursor_color:                customRow.cursor_color ?? 'rose',
        font_customization_unlocked: customRow.font_customization_unlocked ?? false,
        button_hover_style:          customRow.button_hover_style ?? 'none',
        translucent_ui:              customRow.translucent_ui ?? false,
        left_rail_collapsed:         customRow.left_rail_collapsed ?? false,
      }
    : { ...DEFAULT_CUSTOMIZATION };

  return { alreadyCheckedIn: !!checkin, customization };
}

function computeUnlocks(streak: number, existing: string[]): string[] {
  const newUnlocked = [...existing];
  for (const sym of POINTER_SYMBOLS) {
    if (sym.unlockDay > 0 && streak >= sym.unlockDay && !newUnlocked.includes(sym.key)) {
      newUnlocked.push(sym.key);
    }
  }
  return newUnlocked;
}

export async function performDailyCheckin(userId: string): Promise<UserCustomization> {
  const today     = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  await supabase
    .from('user_daily_checkins')
    .insert({ user_id: userId, checkin_date: today })
    .throwOnError();

  const [{ data: yesterdayRow }, { data: existing }] = await Promise.all([
    supabase.from('user_daily_checkins').select('id').eq('user_id', userId).eq('checkin_date', yesterday).maybeSingle(),
    supabase.from('user_customization').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  const prevStreak  = existing?.current_streak ?? 0;
  const newStreak   = yesterdayRow ? prevStreak + 1 : 1;
  const newLongest  = Math.max(existing?.longest_streak ?? 0, newStreak);
  const newTotal    = (existing?.total_checkins ?? 0) + 1;
  const newUnlocked = computeUnlocks(newStreak, existing?.unlocked_pointers ?? ['star']);
  const fontUnlocked = newStreak >= 20 ? true : (existing?.font_customization_unlocked ?? false);

  const updates = {
    user_id:                     userId,
    current_streak:              newStreak,
    longest_streak:              newLongest,
    total_checkins:              newTotal,
    unlocked_pointers:           newUnlocked,
    font_customization_unlocked: fontUnlocked,
    updated_at:                  new Date().toISOString(),
  };

  if (existing) {
    await supabase.from('user_customization').update(updates).eq('user_id', userId).throwOnError();
  } else {
    await supabase.from('user_customization').insert({
      ...updates,
      active_pointer:  'star',
      tile_colors:     {},
      show_trail:      false,
      trail_style:     'solid',
      animation_style: 'stars',
      cursor_color:    'rose',
    }).throwOnError();
  }

  return {
    active_pointer:              existing?.active_pointer       ?? 'star',
    unlocked_pointers:           newUnlocked,
    tile_colors:                 existing?.tile_colors           ?? {},
    current_streak:              newStreak,
    longest_streak:              newLongest,
    total_checkins:              newTotal,
    show_trail:                  existing?.show_trail            ?? false,
    trail_style:                 existing?.trail_style           ?? 'solid',
    animation_style:             existing?.animation_style       ?? 'stars',
    cursor_color:                existing?.cursor_color          ?? 'rose',
    font_customization_unlocked: fontUnlocked,
    button_hover_style:          existing?.button_hover_style    ?? 'none',
    translucent_ui:              existing?.translucent_ui        ?? false,
    left_rail_collapsed:         existing?.left_rail_collapsed   ?? false,
  };
}

export async function updateActivePointer(userId: string, pointerKey: string): Promise<void> {
  await supabase.from('user_customization')
    .upsert({ user_id: userId, active_pointer: pointerKey, updated_at: new Date().toISOString() })
    .throwOnError();
}

export async function updateCursorPrefs(userId: string, prefs: Partial<{
  show_trail:          boolean;
  trail_style:         string;
  animation_style:     string;
  cursor_color:        string;
  button_hover_style:  string;
  translucent_ui:      boolean;
  left_rail_collapsed: boolean;
}>): Promise<void> {
  await supabase.from('user_customization')
    .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() })
    .throwOnError();
}
