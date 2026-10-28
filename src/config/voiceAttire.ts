import type { AvatarConfigV2, Outfit, Bottom, Headwear } from '../types/avatar-v2';
import { outfitItem, bottomItem, type AvatarUnlocks } from '../data/avatarItems';
import { SIGNATURE_VOICES } from './signatureVoices';

/**
 * The outfit each signature voice comes dressed in (docs/onboarding/voice-attire.md). The look page opens in it, a
 * random match is made in it, and for someone who is not a member it is the look: they wear their voice's attire and
 * cannot change it, while members can edit anything. The pieces it uses that are member-only are therefore treated
 * as owned for that companion (see `attireUnlocks`), and the database mirrors that rule
 * (supabase/migrations/*companion_voice_attire.sql, kept in step by a test).
 */
interface Pieces {
  top: Outfit;
  bottom: Bottom;
  hat: Headwear;
  /** Colours for the shirt and pants when the piece's own are not right for the voice. */
  colors?: { top?: string; topAccent?: string; bottom?: string; bottomAccent?: string };
  extras?: Partial<AvatarConfigV2>;
}

const ATTIRE: Record<string, Pieces> = {
  cheerleader: { top: 'cheer', bottom: 'cheer_skirt', hat: 'hair_bow' },
  french_romantic: { top: 'linen', bottom: 'trousers', hat: 'beret', extras: { necklace: 'pendant' } },
  cool_beauty: { top: 'suit', bottom: 'trousers', hat: 'none', colors: { top: '#2b2f3a', topAccent: '#8a2d3b' }, extras: { necklace: 'pearls', necklaceColor: '#f4f1ea' } },
  homie: { top: 'streetwear', bottom: 'baggy', hat: 'snapback', extras: { necklace: 'chain', necklaceColor: '#c9a24a' } },
  brooklyn_native: { top: 'streetwear', bottom: 'baggy', hat: 'beanie', colors: { top: '#2b2f3a', topAccent: '#e0a43a' }, extras: { necklace: 'chain', necklaceColor: '#c9a24a' } },
  bad_boy: { top: 'rockstar', bottom: 'leather', hat: 'none', extras: { facialHair: 'stubble' } },
  cold_prince: { top: 'suit', bottom: 'trousers', hat: 'none', colors: { top: '#14161c', topAccent: '#6b7280', bottom: '#14161c' } },
  surfer_dude: { top: 'tee', bottom: 'shorts', hat: 'bucket_hat', colors: { top: '#8fb8c9' }, extras: { facialHair: 'stubble' } },
  goth_girl: { top: 'tee', bottom: 'skirt', hat: 'none', colors: { top: '#101013', bottom: '#101013' }, extras: { necklace: 'choker', necklaceColor: '#101013', eyeliner: 'bold', eyeShadow: 'smoky', lipColor: '#4a1536' } },
  british_gentleman: { top: 'suit', bottom: 'trousers', hat: 'none', colors: { top: '#3a3d46', topAccent: '#6b4a2a' }, extras: { glasses: 'round' } },
  therapist: { top: 'linen', bottom: 'trousers', hat: 'none', extras: { glasses: 'round' } },
  big_sister: { top: 'tee', bottom: 'jeans', hat: 'none', colors: { top: '#a8553a' }, extras: { earrings: 'hoops' } },
  rnb_lover: { top: 'tee', bottom: 'trousers', hat: 'none', colors: { top: '#2b2f3a' }, extras: { necklace: 'chain', necklaceColor: '#c9a24a' } },
  gentle_protector: { top: 'linen', bottom: 'jeans', hat: 'beanie' },
  shy_sweetheart: { top: 'tee', bottom: 'skirt', hat: 'headband', colors: { top: '#d9c7e8', bottom: '#6e5a86' }, extras: { glasses: 'round' } },
  genki_girl: { top: 'tee', bottom: 'shorts', hat: 'headband', colors: { top: '#f2b705', bottom: '#3d5b8a' }, extras: { earrings: 'studs' } },
  valley_girl: { top: 'tee', bottom: 'skirt', hat: 'headband', colors: { top: '#f3b6c8', bottom: '#e8d9f0' }, extras: { earrings: 'hoops' } },
  bookworm: { top: 'linen', bottom: 'skirt', hat: 'beret', extras: { glasses: 'round' } },
  southern_gentleman: { top: 'linen', bottom: 'trousers', hat: 'cowboy_hat' },
  jock: { top: 'letterman', bottom: 'jeans', hat: 'baseball_cap', colors: { top: '#c2262e', topAccent: '#f4f1ea' } },
  determined_hero: { top: 'hero', bottom: 'jeans', hat: 'headband' },
  playful_trickster: { top: 'streetwear', bottom: 'jeans', hat: 'none', colors: { top: '#6e3c50', topAccent: '#17171b' }, extras: { earrings: 'dangles', faceAccessory: 'fox_mask' } },
  nerd: { top: 'cardigan', bottom: 'trousers', hat: 'none', extras: { glasses: 'square' } },
  tsundere: { top: 'uniform', bottom: 'plaid_skirt', hat: 'hair_bow' },
  shakespearean: { top: 'doublet', bottom: 'breeches', hat: 'none' },
  southern_belle: { top: 'sundress', bottom: 'skirt', hat: 'hair_bow', colors: { bottom: '#f3b6c8' }, extras: { necklace: 'pearls', necklaceColor: '#f4f1ea' } },
};

function build(p: Pieces): Partial<AvatarConfigV2> {
  const top = outfitItem(p.top), bottom = bottomItem(p.bottom);
  return {
    outfit: top.id, outfitColor: p.colors?.top ?? top.color, outfitAccent: p.colors?.topAccent ?? top.accent,
    bottom: bottom.id, bottomColor: p.colors?.bottom ?? bottom.color, bottomAccent: p.colors?.bottomAccent ?? bottom.accent,
    headwear: p.hat, faceAccessory: 'none',
    ...p.extras,
  };
}

/** What a voice comes dressed in, or null for a voice with none (the professional classics). */
export function voiceAttire(voiceId: string | null | undefined): Partial<AvatarConfigV2> | null {
  const p = voiceId ? ATTIRE[voiceId] : undefined;
  return p ? build(p) : null;
}

/** The voices that have attire, for tests and the database mirror. */
export const ATTIRE_VOICE_IDS = Object.keys(ATTIRE);

/** The shirt, pants and hat of a voice's attire, as `slot:id` (the form avatar_inventory and the unlock check use). */
export function voiceAttirePieces(voiceId: string | null | undefined): string[] {
  const a = voiceAttire(voiceId);
  if (!a) return [];
  return [`outfit:${a.outfit}`, `bottom:${a.bottom}`, ...(a.headwear && a.headwear !== 'none' ? [`headwear:${a.headwear}`] : [])];
}

/** Someone's unlocks for dressing a companion: the voice's own attire counts as owned, whatever their membership. */
export function attireUnlocks(base: AvatarUnlocks, voiceId: string | null | undefined): AvatarUnlocks {
  return { ...base, owned: [...(base.owned ?? []), ...voiceAttirePieces(voiceId)] };
}

/** Every voice a person can pick has attire. */
export const PICKABLE_VOICE_IDS = SIGNATURE_VOICES.filter(v => v.category !== 'professional').map(v => v.id);
