# Character model pipeline

## Decision

Gridfall now uses **Synty Sidekick Modern Civilians** as the intended visual base for human runners.

The previous Quaternius/Blender pilot proved the GLB runtime path, but producing bespoke characters by retargeting and rebuilding third-party meshes was consuming more engineering time than it was worth. That experiment is retired. The procedural characters remain the runtime fallback until licensed Sidekick exports are available locally.

Official product:
- https://syntystore.com/products/modern-civilians-sidekick-modular-characters

Official licence:
- https://syntystore.com/pages/one-time-purchase-licence
- https://syntystore.com/community/faq

## Why Sidekick

Sidekick already provides the expensive pieces we were rebuilding:
- modular rigged human parts;
- Unity Humanoid / Mecanim compatibility;
- body blend shapes;
- facial blend shapes;
- hair and clothing designed to mix cleanly;
- a Character Creator that can bake a completed character into a single optimized prefab.

Gridfall does **not** need a runtime character creator. We author Carla and Bruno in Sidekick, bake each one, export one runtime character per runner, then let Three.js own only animation playback and rendering.

## Asset handling

Synty assets are licensed assets, not repository source.

Never commit:
- Synty Unity packages;
- Sidekick source meshes;
- baked Sidekick FBX/GLB files;
- textures copied from Sidekick.

Local source directory:

```
.licensed/sidekick/
└── input/
    ├── carla.glb
    └── bruno.glb
```

Local runtime directory:

```
public/assets/licensed/sidekick/
├── carla.glb
└── bruno.glb
```

Both locations are gitignored.

Install locally:

```sh
npm run character:install-sidekick
```

Or from another export directory:

```sh
npm run character:install-sidekick -- /absolute/path/to/exports
```

The installer validates the humanoid skeleton before copying anything into the Vite public tree.

## Carla authoring brief

Use Sidekick Modern Civilians as the base.

Visual targets:
- younger, shorter silhouette than an adult NPC;
- slightly stylized head proportions;
- straight warm light-brown hair;
- unmistakable blonde streak at the front fringe;
- practical casual/ranch-influenced clothing;
- whip is a separate prop attached to the right hand;
- Border Collie is a separate actor, not part of Carla's skeleton.

Keep the face readable from the gameplay camera. Do not chase realistic micro-detail.

## Bruno authoring brief

Visual targets:
- young sporty silhouette;
- short messy brown hair;
- casual/sport clothing;
- football remains a separate gameplay prop;
- strong leg silhouette for kick anticipation;
- energetic facial expression.

## Runtime contract

The canonical code lives in:
- `src/characters/characterRig.js`
- `src/characters/characterManifest.js`
- `src/characters/CharacterAssetLoader.js`

Rules:
- simulation owns position, collision, facing and hit timing;
- imported characters are presentation only;
- root motion stays disabled;
- characters normalize to the existing gameplay footprint;
- the loader validates semantic humanoid roles rather than a vendor-specific joint count;
- right-hand and foot sockets are resolved semantically;
- failed/missing licensed assets fall back to the current procedural runner.

Inspect an exported candidate:

```sh
npm run character:inspect -- /path/to/carla.glb --verify-sidekick
```

## Web distribution gate

Do not publish Sidekick GLBs through GitHub Pages yet.

Synty's current licence allows licensed assets to be incorporated into videogames, but its Sidekick FAQ also says baked-down character assets must not be redistributed outside the working team. A browser game necessarily delivers its render assets to the client, so we need written confirmation from Synty that our intended web delivery is compliant before putting Sidekick GLBs in a public Pages artifact.

Until then:
- local development with licensed exports is allowed by our repository policy;
- licensed files stay out of Git;
- the public build keeps the procedural fallback.

## Promotion gate

A Sidekick Carla/Bruno export is accepted only when:
1. its silhouette is clearly better than the procedural model;
2. `--verify-sidekick` passes;
3. the gameplay camera shows no clipping or scale regression;
4. basic locomotion and attack poses deform cleanly;
5. the model stays within the budget in `characterManifest.js`;
6. web distribution has been cleared for this deployment model.
