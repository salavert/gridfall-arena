# Changelog

All notable changes to Gridfall Arena are documented here.

## [0.3.0] - 2026-09-19

### Added

- Volt workshop-robot model with orange enamel, cream armor, expressive visor, antenna, induction cannon and three ammo indicators.
- Tap-to-scatter / hold-to-focus cannon, with a narrowing aim guide, charge meter, animated barrel fins, charged-shot effects and layered positional sound.
- Charged long-range attacks for Volt bots and delayed evasive reactions to visible charging opponents, respecting walls and the void.
- Production-engine combat tests covering mouse/touch releases, cancellations, ammo, bot reactions and all four character models.
- Reproducible selection portrait rendered directly from the playable model.

### Fixed

- Simulation now uses fixed 60 Hz steps instead of losing elapsed time at low FPS. Long tab suspensions do not fast-forward combat.
- Runtime quality adaptation now includes frame times between 100 and 500 ms.
- Starting another match clears pause and held-fire state; charge is cancelled on focus loss, pause and conflicting actions.
- Rendering initialization failure now displays an actionable message.

### Performance

- Shared Volt geometry and merged static pieces: 6,684 triangles and 41 model meshes, excluding existing player rings.
- Aim guides reuse cached geometry while charging.

### Validation

- Automated combat, model and timing tests and the production build pass.
- CPU model preview checked. WebGL gameplay and FPS measurements were unavailable in the development browser; no GPU performance gain is claimed.

## [0.2.0] - 2026-09-19

### Changed

- Replaced the sparse vertical slice with a complete eight-runner arena game.
- Rebuilt the interface around a high-contrast neon broadcast identity.
- Added four distinct combat kits: Volt, Spectre, Hex, and Colossus.
- Accelerated reloads, Overdrive charge, cover destruction, and the void timeline for shorter, denser matches.
- Added destructible cover, core drops, bushes, water, varied procedural arenas, combat bots, aim previews, and spectator results.
- Restored dynamic day-to-blackout lighting, shadows, ambient occlusion, bloom, particles, camera feedback, animation, synthesized positional audio, and mobile controls.
- Added automatic quality selection and runtime performance adaptation.
- Reworked all player-facing terminology around runners, cores, Overdrive, and the collapsing void.

## [0.1.0] - 2026-09-19

### Added

- Original sci-fi identity, interface, runners, audio language, and arena design.
- Solo arena loop with seven autonomous rivals.
- Destructible relay mechanic that severs playable floor sectors.
- Timed grid collapse with readable warning tiles and void damage.
- Core shards, three weapon levels, phase dash, and Overdrive.
- Procedural character and environment geometry with no game art assets.
- Half-resolution GTAO, bloom, FXAA, dynamic resolution, and throttled VSM shadows.
- Pooled GPU particles and synthesized positional audio.
- Deterministic rule tests and automated GitHub Pages deployment.
