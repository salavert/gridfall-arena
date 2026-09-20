# Gridfall Arena

Gridfall Arena is a fast solo arena brawler built with Three.js. Pick one of four radically different runners, destroy cover, steal dropped cores, charge Overdrive, and be the final signal alive when the void consumes the grid.

## Play

The latest published version is deployed from `main` through the manual GitHub Pages workflow:

**https://salavert.github.io/gridfall-arena/**

| Control | Action |
| --- | --- |
| `WASD` / arrows | Move |
| Mouse | Aim |
| Left click | Volt: tap for scatter, hold and release for a focused shot. Other runners: fire |
| `Space` / right click | Hold to aim Overdrive, release to deploy |
| `T` | Cycle the lighting phase |
| `P` | Pause |
| `M` | Mute |

## The Gridfall run

- **Four complete combat kits:** Volt's chargeable induction cannon, Spectre's rail burst, Hex's arcing rift cores, and Colossus's crushing phase leap.
- **Destructible tactical cover:** crates and breakable walls turn every fight into a changing arena.
- **Core snowball with counterplay:** eliminations and boxes drop cores that increase health and damage, but those gains return to the field when a runner falls.
- **Escalating collapse:** the void closes sooner and faster, forcing the final duel instead of letting matches drift.
- **Day-to-blackout spectacle:** dynamic sun, lamps, shadows, ambient occlusion, bloom, particles, camera shake, animation, positional sound, and a full mobile control scheme.
- **Procedural production:** the arena, characters, cover, effects, animation, textures, and audio are produced in code without external game art assets.

## Rendering and performance

- Four quality profiles scale pixel ratio, MSAA, AO, bloom, shadow resolution, lamp shadows, and pooled lights.
- A short startup benchmark chooses a suitable profile unless the player makes an explicit choice.
- Runtime monitoring steps quality down if sustained performance falls below the target.
- Procedural textures, instancing, pooled particles, limited dynamic lights, and spatialized synthesized audio keep the game asset-free.
- A fixed 60 Hz simulation maintains movement and combat speed at ordinary low frame rates. Long tab suspensions are discarded.
- Volt uses 6,684 triangles and 41 model meshes, with static pieces merged by material and geometry shared between instances.
- Vite bundles the modern bootstrap and feature modules; the legacy Three/runtime kernel is isolated from gameplay subsystems and loaded before them.

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
index.html                 document, UI shell and production bootstrap tag
src/runtime.js             small production orchestrator and dependency bridge
public/runtime/kernel.js   isolated legacy Three.js/runtime kernel
public/runtime/Renderer.js production renderer and post-processing
public/runtime/Lighting.js lighting, environment and shared runtime math
public/runtime/Arena.js    procedural arena, materials, water, hazards and objectives
public/runtime/Runner.js   playable runner model integration and animation
public/runtime/Combat.js   projectiles, bombs, boxes, cores and telegraphs
public/runtime/Effects.js  pooled particles, decals, debris and combat VFX
public/runtime/Void.js     collapsing-grid simulation and visuals
public/runtime/AI.js       bot tactics and combat decisions
public/runtime/Input.js    keyboard, mouse and touch input
public/runtime/Hud.js      menu, combat HUD, warnings and overlays
public/runtime/Game.js     match orchestration, camera and game state
src/game/                  production roster, rules, AI tuning and world constants
src/presentation/          pure presentation tuning used by production systems
src/systems/               production procedural audio
src/volt/                  Volt model, combat behavior and fixed simulation clock
scripts/                   reproducible CPU portrait renderer
tests/                     combat integration, timing, architecture and release tests
```

The production runtime is intentionally split without changing gameplay behavior. The remaining compatibility seam is `public/runtime/kernel.js`, which still contains the minified Three.js-derived kernel and legacy aliases. New gameplay or presentation code should go into the named production subsystem files or the normal `src/*` modules, not back into the kernel.

## Volt art and validation

Volt is a small orange workshop robot with cream armor, a dark expressive visor, cyan induction coils and an oversized cannon. Charging narrows the pellet cone and increases range, while the barrel fins close and spin. Bots visibly prepare long-range shots and can dodge a visible enemy charge after a reaction delay.

`npm run portrait` regenerates the selection portrait from the playable geometry, using a deterministic CPU renderer. It is an illustration of the actual model, not a WebGL gameplay capture.

The combat tests load the current production runner and bundled Three classes. GPU visuals, actual device performance and final balance still require playtesting in a WebGL-enabled browser.

## Release and deployment

Every push to `main` runs `npm run check` in CI. GitHub Pages deployment is intentionally manual through the `Deploy GitHub Pages` workflow, so visual work can land without publishing every intermediate commit. Tagged versions should follow semantic versioning:

```bash
npm version patch
git push --follow-tags
```

Keep `package.json` and `CHANGELOG.md` aligned for every public release.

## License

Gridfall Arena is available under the [MIT License](LICENSE). Three.js is also MIT licensed; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
