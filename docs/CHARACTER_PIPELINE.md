# Character model pipeline

## Decision

Gridfall will use the **Quaternius Universal Base Characters (UBC) humanoid rig as the character-authoring contract**, while keeping the current procedural runners as a runtime fallback until replacement GLBs pass the visual and technical gate.

KayKit remains a useful reference for low-cost animation and material discipline, but it is not the visual base for Carla and Bruno.

## Why Quaternius

Measured from a public copy of the free Standard UBC glTF files:

| Asset | Triangles | Joints | Meshes | Materials | Embedded animations |
| --- | ---: | ---: | ---: | ---: | ---: |
| Superhero Female | 15,060 | 65 | 3 | 3 | 0 |
| Superhero Male | 14,318 | 65 | 3 | 3 | 0 |

The 65-joint rig includes the complete torso, arms, legs, feet and articulated fingers. Its bone naming is also shared by current Quaternius modular outfits and the Universal Animation Library.

Official sources:
- https://quaternius.com/packs/universalbasecharacters.html
- https://quaternius.itch.io/universal-base-characters
- https://quaternius.itch.io/universal-animation-library
- https://quaternius.itch.io/modular-character-outfits-fantasy

License: CC0 1.0. No paid pack is required by this repository and no purchase has been made.

The official UBC page describes six base proportions and 20 hairstyles. The free Standard archive is a partial release; the public Standard copy inspected for this decision contains the Superhero male/female bases plus a subset of hairstyles. We therefore treat UBC as a **rig/topology reference**, not as finished Carla/Bruno art.

## KayKit comparison

KayKit Adventurers is extremely efficient and already bundles its characters with a large clip library. Its shared `Rig_Medium` is only 23 joints in widely used implementations, its Adventurers GLBs are roughly 3.6 MB each before optimization, and KayKit's separate Character Animations pack advertises 161 humanoid animations.

That is excellent for prototypes. It is not the best identity foundation for Gridfall because the visual style is more recognisable as stock KayKit and gives us less facial/hair articulation to push toward the Carla and Bruno reference sheets.

## Runtime contract

The canonical contract lives in:
- `src/characters/characterRig.js`
- `src/characters/characterManifest.js`
- `src/characters/CharacterAssetLoader.js`

Important constraints:
- simulation owns position, facing, collision and hit timing;
- imported meshes are presentation only;
- root motion is disabled;
- feet are authored at Y=0;
- the UBC joint names remain stable;
- Carla and Bruno get original character-specific attack/super clips;
- a failed or missing GLB must fall back to the existing procedural runner.

The current production runtime still uses the extracted classic Three.js kernel. The rigged character loader deliberately imports from the existing npm `three@0.180.0` dependency and is **not wired into production yet**. Do not mix the new loader into `Runner.js` until the first pilot GLB has been visually validated and the scene bridge has been exercised.

## Asset budget

First shipping target per character:
- <= 18k triangles;
- <= 4 materials;
- <= 6 textures;
- <= 1024 px texture dimension;
- <= 2.5 MB transferred GLB after optimization;
- one 65-joint skin;
- no cameras or lights;
- no root motion.

The target gameplay height is 1.42 scene units so a rigged replacement stays close to the visual footprint of the current runner rather than introducing a hidden gameplay-scale change.

## Authoring order

1. Build one neutral `base-child` pilot on the UBC skeleton.
2. Validate silhouette and movement in Gridfall before making character-specific variants.
3. Author Carla from that base: straight/light brown hair, blonde fringe streak, ranch-influenced outfit, whip socket on `hand_r`.
4. Author Bruno from the same base: short messy hair, sporty/ranch outfit, ball as a separate gameplay prop.
5. The Border Collie is a separate actor and separate rig. It is not added to Carla's human skeleton.
6. Only after Carla and Bruno are convincing do we migrate the other runners.

## Local inspection

Inspect any candidate without Blender:

```sh
npm run character:inspect -- /path/to/character.glb
npm run character:inspect -- /path/to/character.glb --verify-ubc
```

This reports triangle/material/skin/animation counts and verifies the exact UBC joint contract.

## Source handling

When assets are finally vendored:
- download from the official creator page, not a mirror;
- preserve the upstream license beside the source record;
- record archive hash, acquisition date and transformations;
- keep large source packs out of the runtime tree;
- commit only the prepared shipping GLBs and the small provenance files required to reproduce them.
