import { postToParent } from '../bridge/protocol';
import { type Agent, type AgentId } from '../state/agents';
import { wearOnAgent, validOutfit, validWardrobe, closetFromWardrobe, AVATAR_HATS, type OwnedCloth } from '../state/clothing';
import { validHeadSvgs, loadHeadImages } from '../state/headSprites';
import { validBodySvgs, loadBodyImages } from '../state/bodySprites';
import type { Game } from '../kernel/game';

export function createAvatar(g: Game): Partial<Game> {
  const { people, closet, flags, dialogue } = g;
  // The real avatar: its head frames, and its outfit as the signature look.
  // The signature goes on when it's new or changed; otherwise whatever they
  // last wore stays on. The player's is always in the closet to switch back to.
  function applyAvatar(person: Agent, look: { sprites?: unknown; body?: unknown; outfit?: unknown }, who: AgentId): void {
    const hands = validBodySvgs(look.body);
    if (hands) loadBodyImages(hands).then((imgs) => { if (imgs.relaxed) person.look.body = imgs; }).catch(() => {});
    const svgs = validHeadSvgs(look.sprites);
    if (svgs) {
      loadHeadImages(svgs).then((imgs) => {
        if (!imgs.neutral) return;
        person.look.heads = imgs;
        if (person === people[1]) dialogue.setPortraitImages(imgs);
      }).catch(() => {});
    }
    // The player's wardrobe: every piece they may wear joins the closet, and personas become buttons.
    const wardrobeIn = who === 'jordan' ? validWardrobe((look as { wardrobe?: unknown }).wardrobe) : null;
    if (wardrobeIn) {
      g.s.wardrobe = wardrobeIn;
      g.s.wornHat = wardrobeIn.hat ?? 'none';
      for (let i = closet.length - 1; i >= 0; i--) if (closet[i].id.startsWith('w-')) closet.splice(i, 1);
      closet.push(...closetFromWardrobe(wardrobeIn));
    }
    const outfit = validOutfit(look.outfit);
    if (!outfit) return;
    if (who === 'jordan') {
      for (let i = closet.length - 1; i >= 0; i--) if (closet[i].id.startsWith('sig-')) closet.splice(i, 1);
      closet.unshift(
        { slot: 'top', style: outfit.style, col: outfit.color, accent: outfit.accent, name: 'Signature look', id: 'sig-top' },
        { slot: 'bottom', style: outfit.bottomStyle, col: outfit.bottom, accent: outfit.bottomAccent, name: 'Signature bottoms', id: 'sig-bottom' },
      );
    }
    const keys = (flags.signature ?? (flags.signature = {})) as Record<string, string>;
    if (keys[who] !== outfit.key) {
      Object.assign(person.look, {
        topStyle: outfit.style, top: outfit.color, accent: outfit.accent,
        bottom: outfit.bottom, bottomStyle: outfit.bottomStyle, bottomAccent: outfit.bottomAccent,
      });
      keys[who] = outfit.key;
    }
  }

  // Putting a closet piece on the player. A hat is on the avatar's head, so it waits for the host's new head frames.
  function wearPiece(piece: OwnedCloth): void {
    if (piece.slot === 'hat') { if (AVATAR_HATS.has(piece.style)) g.s.wornHat = piece.style; return; }
    wearOnAgent(people[0].look, piece);
  }

  // Tell the host what the player changed into, so their avatar outside the game matches.
  function tellHostLook(top?: OwnedCloth, bottom?: OwnedCloth, hat?: string): void {
    postToParent({
      type: 'velvet:lookChanged', game: 'velvet-house', who: 'player',
      ...(top ? { top: { style: top.style, color: top.col, accent: top.accent } } : {}),
      ...(bottom ? { bottom: { style: bottom.style, color: bottom.col, accent: bottom.accent } } : {}),
      ...(hat !== undefined ? { hat } : {}),
    } as never);
  }
  return { applyAvatar, wearPiece, tellHostLook };
}
