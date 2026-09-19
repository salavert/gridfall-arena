# Gridfall Arena

Gridfall Arena is a fast procedural arena action game built with Three.js. Overload energy relays, disconnect sectors beneath your rivals, collect core shards that mutate your weapon, and survive the collapsing grid.

This is an original clean-room implementation. Its code, setting, UI, characters, rules, geometry, effects, and audio were created for this repository. It does not include code or game assets from Brawl Stars, Sundown Showdown, Supercell, or any other game.

## Play

The latest version is deployed automatically from `main` through GitHub Pages:

**https://salavert.github.io/gridfall-arena/**

| Control | Action |
| --- | --- |
| `WASD` / arrows | Move |
| Mouse | Aim |
| Left click | Fire |
| `Space` | Phase dash |
| `E` | Activate Overdrive at full core charge |

## What makes it different

- **Weaponized arena:** destroying one of four relays severs its surrounding floor after a visible fuse.
- **Readable collapse:** warning tiles telegraph the void before the safe grid contracts.
- **Run-time weapon evolution:** every three core shards changes the pulse pattern from single to twin to tri-shot.
- **Three distinct runners:** Flux focuses on mobility, Nova on disruption, and Rook on control.
- **Procedural presentation:** characters, cover, arena, particles, textures, animation, and audio are generated in code.

## Rendering and performance

- Rounded procedural geometry catches highlights without model files.
- A shared stylized PBR material adds vertical shading and rim light.
- GTAO runs at half resolution with an eight-sample denoise pass.
- Bloom is intentionally restrained and FXAA replaces expensive MSAA.
- Dynamic resolution targets a stable frame time between 0.72× and 1.45× device scale.
- VSM shadows update at most 12 times per second and only while the match needs them.
- Repeated floor modules use `InstancedMesh`.
- Particles use a preallocated GPU point buffer.

The v0.1.0 production build is approximately 614 KB uncompressed and 159 KB gzip, including Three.js and post-processing.

## Development

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Validation:

```bash
npm run check
```

## Structure

```text
src/
  core/        game loop, input, HUD, deterministic rules
  entities/    runners and combat state
  rendering/   pipeline, materials, procedural models
  systems/     audio and VFX pools
  world/       arena generation, relays, cover, collapse
tests/         deterministic unit tests
```

## Release and deployment

Every push to `main` runs tests, builds the production bundle, and deploys it to GitHub Pages. Tagged versions should follow semantic versioning:

```bash
npm version patch
git push --follow-tags
```

Keep `package.json`, the menu version, and `CHANGELOG.md` aligned until version display is generated at build time.

## License

Gridfall Arena is available under the [MIT License](LICENSE). Three.js is also MIT licensed; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
