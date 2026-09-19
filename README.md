# Gridfall Arena

Gridfall Arena is a fast solo arena brawler built with Three.js. Pick one of four radically different runners, destroy cover, steal dropped cores, charge Overdrive, and be the final signal alive when the void consumes the grid.

## Play

The latest version is deployed automatically from `main` through GitHub Pages:

**https://salavert.github.io/gridfall-arena/**

| Control | Action |
| --- | --- |
| `WASD` / arrows | Move |
| Mouse | Aim |
| Left click | Fire |
| `Space` / right click | Hold to aim Overdrive, release to deploy |
| `T` | Cycle the lighting phase |
| `P` | Pause |
| `M` | Mute |

## The Gridfall run

- **Four complete combat kits:** Volt's scatter cannon, Spectre's rail burst, Hex's arcing rift cores, and Colossus's crushing phase leap.
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
- The complete release is delivered as a single cached page, including Three.js and post-processing.

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
index.html     current self-contained production game
src/           archived v0.1 modular prototype, retained during migration
tests/         deterministic rules and release contract tests
```

## Release and deployment

Every push to `main` runs tests, builds the production bundle, and deploys it to GitHub Pages. Tagged versions should follow semantic versioning:

```bash
npm version patch
git push --follow-tags
```

Keep `package.json` and `CHANGELOG.md` aligned for every public release.

## License

Gridfall Arena is available under the [MIT License](LICENSE). Three.js is also MIT licensed; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
