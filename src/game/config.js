export const TILES = Object.freeze({ EMPTY: 0, WALL: 1, BUSH: 2, WATER: 3 });
export const SURFACES = Object.freeze({ STONE: 0, CRATE: 1, BARREL: 2, CACTUS: 3, ROCK: 4, LAMP: 5 });
export const RUNNER_RADIUS = 0.4;
export const RULES = Object.freeze({
  bots: 7,
  gasDelay: 22,
  gasDuration: 115,
  gasStartHalf: 25,
  gasEndHalf: 3.5,
  startHour: 16.8,
  endHour: 22.1,
  dayLength: 170,
  boxHp: 3200,
  cubeHp: 450,
  cubeDamage: 0.12,
});
export const LAMP = Object.freeze({ height: 3.05, arm: 0.62, near: 0.4, far: 10.5, angle: 1, size: 0.55, nearClamp: 2.3 });

export const RUNNERS = Object.freeze({
  volt: {
    id: 'volt', name: 'VOLT', role: 'The little heavy hitter',
    blurb: 'Tap for buckshot. Hold, focus, release for a precision blast.',
    hp: 4100, speed: 3.25, reload: 1.18, preferred: 3.6,
    palette: { body: 16021307, accent: 2734255, skin: 16770220, dark: 1649978 },
    superCharge: 2500,
    attack: { kind: 'spread', pellets: 5, spread: 0.55, range: 6.5, speed: 16, damage: 300, radius: 0.13, color: 9437168 },
    super: { kind: 'spread', pellets: 9, spread: 0.85, range: 8.5, speed: 17, damage: 360, radius: 0.2, color: 16764009, knockback: 9, breaksWalls: true },
  },
  spectre: {
    id: 'spectre', name: 'SPECTRE', role: 'Railgunner',
    blurb: 'Precision six-shot rail burst at extreme range.',
    hp: 3100, speed: 3.35, reload: 1.32, preferred: 6.8,
    palette: { body: 6846719, accent: 6157055, skin: 16054271, dark: 1514811 },
    superCharge: 3000,
    attack: { kind: 'burst', count: 6, interval: 0.08, range: 9.5, speed: 19, damage: 330, radius: 0.13, color: 6157055, jitter: 0.035 },
    super: { kind: 'burst', count: 12, interval: 0.055, range: 12, speed: 22, damage: 360, radius: 0.2, color: 16762967, jitter: 0.05, pierce: true, breaksWalls: true },
  },
  hex: {
    id: 'hex', name: 'HEX', role: 'Rift Caster',
    blurb: 'Launches unstable cores over cover.',
    hp: 3050, speed: 3.1, reload: 1.4, preferred: 5.8,
    palette: { body: 9133311, accent: 16732120, skin: 16054271, dark: 1053999 },
    superCharge: 2500,
    attack: { kind: 'lob', range: 7.5, flight: 0.72, hex: 0.38, blast: 1.55, damage: 920, color: 16732120 },
    super: { kind: 'lob', range: 8.8, flight: 0.9, hex: 0.58, blast: 3, damage: 2450, color: 9133311, knockback: 10, breaksWalls: true, big: true },
  },
  colossus: {
    id: 'colossus', name: 'COLOSSUS', role: 'Juggernaut',
    blurb: 'Massive armor. Crushes targets and phase-leaps.',
    hp: 6400, speed: 3.5, reload: 0.78, preferred: 1.6,
    palette: { body: 3596449, accent: 11009871, skin: 16054271, dark: 1053999 },
    superCharge: 2700,
    attack: { kind: 'melee', count: 4, interval: 0.09, range: 2.7, speed: 13, damage: 390, radius: 0.48, color: 11009871, jitter: 0.12 },
    super: { kind: 'leap', range: 8.5, flight: 0.68, blast: 2.5, damage: 1100, color: 6157055, knockback: 11, breaksWalls: true },
  },
  carla: {
    id: 'carla', name: 'CARLA', role: 'Ranch Whip & Companion',
    blurb: 'Crack the lane with her whip. Send her Border Collie charging with Overdrive.',
    portrait: 'carla-portrait.svg',
    hp: 3700, speed: 3.5, reload: 1.05, preferred: 4.4,
    palette: { body: 10053171, accent: 15044371, skin: 16369888, dark: 4079428 },
    superCharge: 2600,
    attack: { kind: 'burst', count: 1, interval: 0.01, range: 4.9, speed: 30, damage: 850, radius: 0.16, color: 12997772, visual: 'carla-whip' },
    super: { kind: 'burst', count: 1, interval: 0.01, range: 8.4, speed: 10.5, damage: 1500, radius: 0.42, color: 16175215, knockback: 6, pierce: true, visual: 'carla-dog' },
  },
  bruno: {
    id: 'bruno', name: 'BRUNO', role: 'Football Striker',
    blurb: 'Drives the ball through openings. His Overdrive unleashes a massive power shot.',
    portrait: 'bruno-portrait.svg',
    hp: 4000, speed: 3.35, reload: 1.08, preferred: 5.3,
    palette: { body: 4349564, accent: 15111135, skin: 16369888, dark: 2631720 },
    superCharge: 2800,
    attack: { kind: 'burst', count: 1, interval: 0.01, range: 7.2, speed: 14, damage: 780, radius: 0.26, color: 15724527, visual: 'bruno-ball' },
    super: { kind: 'burst', count: 1, interval: 0.01, range: 10, speed: 20, damage: 1950, radius: 0.42, color: 16762445, knockback: 10, breaksWalls: true, visual: 'bruno-mega' },
  },
});

export function classifyImpactSurface(tile, style) {
  if (tile === TILES.WATER) return 'water';
  if (tile === TILES.BUSH) return 'foliage';
  if (tile !== TILES.WALL) return 'ground';
  if (style === SURFACES.CRATE) return 'wood';
  if (style === SURFACES.BARREL || style === SURFACES.LAMP) return 'metal';
  if (style === SURFACES.CACTUS) return 'foliage';
  return 'stone';
}
