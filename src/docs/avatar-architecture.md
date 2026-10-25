# Avatar Architecture — Phase 3 Foundation

## 1. Config Schema Versioning

All avatar configs carry an optional `_version` field (integer).

| Version | Description |
|---------|-------------|
| 1 (legacy) | `AvatarConfig` (v1 SVG, `src/types/avatar.ts`) |
| 2 (current) | `AvatarConfigV2` (`src/types/avatar-v2.ts`) |

### Adding a new field

1. Add the typed field to `AvatarConfigV2` in `src/types/avatar-v2.ts` as **optional**.
2. Add a default value in `V2_OPTIONAL_DEFAULTS` inside `src/utils/avatarConfig.ts`.
3. Add the field to `migrateAvatarConfig` defaults so older stored configs upgrade silently.
4. Expose it in `AvatarCreatorV2`/`GuidedAvatarFlow` editor UI.
5. Render it in `AvatarV2.tsx`.
6. Add it to the randomizer in `AvatarCreatorV2`.
7. Add it to affected avatar presets in `src/data/avatarPresets.ts`.

### Bumping the schema version

Increment `AVATAR_CONFIG_VERSION` in `src/types/avatar-v2.ts`. Add a migration
branch inside `migrateAvatarConfig` that detects the old version number and
back-fills any new required fields.

---

## 2. Migration Utility

`src/utils/avatarConfig.ts` exports three functions:

| Function | Purpose |
|----------|---------|
| `migrateAvatarConfig(raw)` | Accepts any unknown value; returns a fully-typed, version-stamped `AvatarConfigV2`. Safe to call on DB payloads and localStorage. |
| `loadDraftConfig(draftKey)` | Reads a localStorage draft by key and migrates it. Returns `null` if absent or unparseable. |
| `saveDraftConfig(draftKey, config)` | Writes a version-stamped config to localStorage. |

Call `migrateAvatarConfig` at every boundary where a stored config enters the
app (DB select, localStorage hydration, preset application).

---

## 3. Renderer Abstraction

### Interface

```ts
// src/renderers/AvatarRenderer.ts
interface IAvatarRenderer {
  readonly id: string;
  render(config: AvatarConfigV2, className?: string): ReactNode;
}
```

### Registering a renderer

```ts
import { registerAvatarRenderer } from '../renderers/AvatarRenderer';

registerAvatarRenderer({
  id: 'my-3d-renderer',
  render(config, className) {
    return <My3DAvatar config={config} className={className} />;
  },
});
```

### Using the default renderer

```tsx
import { getDefaultRenderer } from '../renderers/AvatarRenderer';
import '../renderers/SVGAvatarRenderer'; // registers svg-v2

const renderer = getDefaultRenderer();
return <>{renderer.render(config, 'w-32 h-32')}</>;
```

The current default is `SVGAvatarRenderer` (id: `svg-v2`). To swap globally,
register a new renderer under `svg-v2` or change the id returned by
`getDefaultRenderer`.

### Future 3D pipeline

When a WebGL/Three.js renderer is ready:
1. Create `src/renderers/ThreeAvatarRenderer.tsx`.
2. Map `AvatarConfigV2` fields to 3D bone/blend-shape targets.
3. Register with a new id (e.g., `three-v1`).
4. Swap `getDefaultRenderer` to return the new id behind a feature flag.
5. The optional fidelity fields (`hairLength`, `makeupIntensity`, `eyeShadow`,
   `eyeliner`, `skinDetail`) are already in the schema, ready to drive 3D
   parameters without a migration.

---

## 4. How a face is drawn

The renderers in `src/renderers/` draw in this order, back to front:
back hair, body, neck, collar, ears, face, features, facial hair, earrings,
front hair, glasses, headwear.

- **Face shape** (`faceGeometry.ts`): each shape is a list of widths down the
  side of the head, joined by a smooth curve, so every shape has a rounded
  crown and its own jaw. `faceHalfWidthAt` reads the width at any height for
  things that sit against the edge (ears, sideburns, framing locks), and the
  beard clips to the same outline.
- **Features** (`faceFeatures.tsx`): lidded eyes with the iris tucked under
  the upper lid, eyeliner built from each eye's own lid line, tapered brows,
  a nose made of a shadow and a highlight, and ears behind the face.
- **Hair** (`hairRenderer.tsx`): a back layer (volume behind the head, long
  lengths, ponytails, buns) and a front layer (the cap over the crown down to
  a real hairline, sideburns, locks that frame the face). Each style is a
  spec: volume, hairline, texture, lengths. Hats clip both layers.
- All texture is seeded, never random, so an avatar draws the same way on
  every render.

## 5. Wardrobe

Outfits, headwear and face accessories (eyepatch) are optional config fields
(`outfit`, `outfitColor`, `outfitAccent`, `headwear`, `faceAccessory`). Older
configs migrate to the navy `tee` every avatar wore before.

- **Catalogue:** `src/data/avatarItems.ts` lists every item with its tier, and
  the medal for earned items. The creator's locks and the display rule both
  read it. Kits (`AVATAR_KITS`) are whole looks; a kit is as locked as its most
  locked item.
- **Tiers:** the same as the Velvet World houses. `starter` is for everyone.
  `member` needs a paid plan. `earned` needs one medal, is never for sale, and
  is never locked by a lapsed plan.
- **Lapsed plans:** `resolveAvatarForDisplay(config, unlocks)` swaps each locked
  item for its `fallback` (always a starter item) and never changes the saved
  config, so rejoining restores the look.
- **Drawing:** `src/renderers/outfitRenderer.tsx`. A garment is drawn once on the
  shared torso, and the body-type stretch fits it to every build. The body sits
  behind the neck; collars, lapels and ties sit in front. A hat names the line
  above which hair is tucked away (`headwearHairCut`).
- **Ids:** anything in `<defs>` that differs per avatar takes its id from
  `useId`, so several avatars on one page never borrow each other's clip or
  colours.

### Adding an item

1. Add the id to the type in `src/types/avatar-v2.ts`.
2. Add it to the catalogue with a tier, a starter fallback, and a medal if earned.
3. Draw it in `outfitRenderer.tsx`.
4. Optionally add or extend a kit.

Not built yet: the server check on save, and the stored "what others see" copy
that the display rule fills in when a plan lapses.

## 6. Performance Notes

### Current hot paths (PERF-NOTE comments in source)

| Location | Cost | Mitigation |
|----------|------|-----------|
| `renderMaleHair` — buzz case | Renders 1,200 `<circle>` nodes | Could be replaced with a single rasterized canvas layer at > 64px display size |
| `renderFemaleHair` — afro case | 500 `<circle>` nodes | Same as above |
| `renderGlasses` | Repeated each render | Memoize by `glasses` value |

### Existing mitigations

- `AvatarV2` is wrapped in `React.memo` with a JSON-equality comparator, so the
  entire SVG tree is skipped when config is unchanged.
- SVG `<defs>` (gradients, filters) are memoized via `useMemo` keyed on
  `skinTone` and face shape dimensions.

### Recommended next steps

1. Canvas-based hair rasterization for buzz/afro at large display sizes.
2. Replace JSON.stringify equality in `memo` comparator with a field-level
   shallow compare once the field list stabilises.
3. Profile with React DevTools Profiler targeting `AvatarCreatorV2` live-edit
   interactions.
