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

## 4. Performance Notes

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
