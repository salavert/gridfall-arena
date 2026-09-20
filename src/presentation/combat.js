const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export function combatIntensity({ damage, kind, isSuper = false, isKill = false, playerInvolved = false }) {
  let damageWeight = clamp(damage / 1800, 0, 1);
  damageWeight = damageWeight * damageWeight * (3 - 2 * damageWeight);
  let intensity =
    0.1 +
    damageWeight * 0.46 +
    (kind === 'melee' ? 0.15 : 0) +
    (isSuper ? 0.22 : 0) +
    (isKill ? 0.25 : 0);
  if (playerInvolved) intensity += 0.03;
  return clamp(intensity, 0.1, 1);
}

export function nearMissPresentation(cross, isSuper = false) {
  const proximity = clamp(1 - cross / 1.05, 0, 1);
  const base = isSuper ? 0.85 : 0.48;
  const strength = base * (0.55 + 0.45 * proximity);
  return {
    strength,
    visualFocus: 0.24 + 0.32 * strength,
    threatFocus: 0.28 + 0.38 * strength,
    combatZoom: 0.008 + 0.014 * strength,
  };
}

export function duelCameraFrame(dx, dz, distance) {
  const frameAmount = clamp((distance - 3) / 8, 0, 1);
  return {
    biasX: dx * 0.22,
    biasZ: dz * 0.22,
    zoom: 0.012 + 0.03 * frameAmount,
  };
}

export function feedbackBands(intensity) {
  return {
    light: smoothstep(0.18, 0.82, intensity),
    medium: smoothstep(0.38, 0.88, intensity),
    heavy: smoothstep(0.68, 1, intensity),
  };
}


export function movementPose({ speed, maxSpeed, forwardSpeed, sideSpeed, angularSpeed, braking = 0 }) {
  const move = clamp(speed / Math.max(maxSpeed, 0.001), 0, 1);
  const forward = clamp(forwardSpeed / Math.max(maxSpeed, 0.001), -1, 1);
  const side = clamp(sideSpeed / Math.max(maxSpeed, 0.001), -1, 1);
  return {
    move,
    forwardLean: forward * 0.095 + braking * 0.12,
    sideLean: side * 0.13 + clamp(angularSpeed * 0.012, -0.13, 0.13) * move,
    torsoTwist: side * 0.12 + clamp(angularSpeed * 0.009, -0.1, 0.1),
    stride: (0.68 + move * 0.24) * move,
  };
}

export function attackIntentPose(kind, progress, isSuper = false) {
  const p = smoothstep(0, 1, clamp(progress, 0, 1));
  const superMul = isSuper ? 1.28 : 1;
  const melee = kind === 'melee' || kind === 'leap';
  const lob = kind === 'lob';
  return {
    plant: p * (melee ? 0.22 : lob ? 0.15 : 0.11) * superMul,
    windup: p * (melee ? 0.34 : lob ? 0.24 : 0.18) * superMul,
    twist: p * (melee ? 0.18 : lob ? -0.12 : 0.08) * superMul,
    crouch: p * (melee ? 0.14 : isSuper ? 0.1 : 0.055),
  };
}

export function hitReactionPose(relativeAngle, heavy = false) {
  const force = heavy ? 1 : 0.62;
  return {
    pitch: clamp(-Math.cos(relativeAngle) * 0.18 * force, -0.2, 0.2),
    tilt: clamp(Math.sin(relativeAngle) * 0.28 * force, -0.28, 0.28),
    twist: clamp(Math.sin(relativeAngle) * 0.2 * force, -0.2, 0.2),
  };
}


export function corePowerPresentation(cubes) {
  const count = Math.max(0, Number.isFinite(cubes) ? cubes : 0);
  const power = 1 - Math.exp(-count / 4.5);
  return {
    power,
    auraOpacity: count > 0 ? 0.035 + power * 0.13 : 0,
    auraScale: 0.9 + power * 0.34,
    weaponScale: 1 + power * 0.045,
    emissive: power * 0.15,
    light: power * 1.35,
  };
}


export function destructionProfile(surface, power = 1) {
  const p = clamp(power, 0.5, 1.8);
  const profiles = {
    stone: { color: 0x9a927f, debris: 12, dust: 9, persist: 0.42, scar: 'crack', scarColor: 0x403a32 },
    wood: { color: 0xa87648, debris: 10, dust: 7, persist: 0.34, scar: 'slash', scarColor: 0x5a3b22 },
    metal: { color: 0xc28a5b, debris: 9, dust: 5, persist: 0.3, scar: 'scorch', scarColor: 0x241b17 },
    foliage: { color: 0x4f7a3e, debris: 5, dust: 3, persist: 0.08, scar: null, scarColor: 0x314128 },
  };
  const base = profiles[surface] || profiles.stone;
  return {
    ...base,
    debris: Math.round(base.debris * (0.72 + p * 0.36)),
    dust: Math.round(base.dust * (0.72 + p * 0.28)),
    velocity: 0.7 + p * 0.48,
    scarSize: 0.13 + p * 0.08,
  };
}

export function superScarProfile(id, power = 1) {
  const p = clamp(power, 0.55, 1.6);
  const profiles = {
    volt: { type: 'electric', decalColor: 0x163d41, aspect: 1.15, life: 52, peak: 0.46, zoneLife: 3.4, zoneAspect: 1.12 },
    spectre: { type: 'slash', decalColor: 0x211c39, aspect: 3.1, life: 46, peak: 0.5, zoneLife: 2.6, zoneAspect: 2.5 },
    hex: { type: 'rift', decalColor: 0x35173e, aspect: 1.25, life: 62, peak: 0.55, zoneLife: 5.1, zoneAspect: 1.18 },
    carla: { type: 'slash', decalColor: 0x3b2b1d, aspect: 2.15, life: 42, peak: 0.42, zoneLife: 2.8, zoneAspect: 1.7 },
    bruno: { type: 'crack', decalColor: 0x2c3039, aspect: 1.55, life: 50, peak: 0.48, zoneLife: 3.1, zoneAspect: 1.45 },
    colossus: { type: 'crack', decalColor: 0x342b27, aspect: 1.45, life: 66, peak: 0.56, zoneLife: 3.2, zoneAspect: 1.35 },
  };
  const base = profiles[id] || profiles.volt;
  return {
    ...base,
    size: (id === 'spectre' ? 0.24 : id === 'carla' ? 0.34 : id === 'bruno' ? 0.44 : id === 'colossus' ? 0.5 : id === 'hex' ? 0.42 : 0.3) * p,
    zoneScale: (id === 'spectre' ? 0.85 : id === 'carla' ? 0.95 : id === 'bruno' ? 1.08 : id === 'colossus' ? 1.2 : id === 'hex' ? 1.05 : 0.9) * p,
  };
}


const ARENA_ZONES = [
  { id: 'dust', x: -10.5, z: -10.5, surface: 'dirt', fog: 0x6f5742, near: 44, far: 94 },
  { id: 'tech', x: 10.5, z: -10.5, surface: 'metal', fog: 0x18334a, near: 48, far: 104 },
  { id: 'stone', x: -10.5, z: 10.5, surface: 'stone', fog: 0x322b46, near: 46, far: 98 },
  { id: 'garden', x: 10.5, z: 10.5, surface: 'foliage', fog: 0x263b31, near: 42, far: 92 },
];

export function arenaZoneProfile(x, z) {
  let best = null;
  let bestDistance = Infinity;
  for (const zone of ARENA_ZONES) {
    const distance = Math.hypot(x - zone.x, z - zone.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = zone;
    }
  }
  if (!best || bestDistance > 8.2) {
    return { id: 'neutral', surface: 'ground', fog: 0x0b0e1a, near: 54, far: 118, blend: 0 };
  }
  const blend = clamp(1 - (bestDistance - 4.6) / 3.6, 0, 1);
  return { ...best, blend };
}

export function contactShadowPresentation({ speed, maxSpeed, height = 0, sideSpeed = 0, anticipation = 0 }) {
  const move = clamp(speed / Math.max(maxSpeed, 0.001), 0, 1);
  const airborne = clamp(1 - height / 3.4, 0.16, 1);
  const side = clamp(Math.abs(sideSpeed) / Math.max(maxSpeed, 0.001), 0, 1);
  return {
    opacity: (0.12 + 0.1 * airborne) * airborne,
    length: (1.05 + move * 0.28 + anticipation * 0.08) * airborne,
    width: (0.74 - move * 0.08 + side * 0.08) * airborne,
    offset: move * 0.08 * airborne,
  };
}

export function incomingProjectileThreat({ along, cross, speed, isSuper = false }) {
  if (along <= 0 || speed <= 0) return null;
  const time = along / speed;
  if (time > 1.15 || cross > 1.2) return null;
  const proximity = clamp(1 - cross / 1.2, 0, 1);
  const urgency = clamp(1 - time / 1.15, 0, 1);
  return {
    time,
    priority: urgency * 0.7 + proximity * 0.3 + (isSuper ? 0.35 : 0),
    opacity: clamp(0.42 + urgency * 0.45 + (isSuper ? 0.13 : 0), 0, 1),
  };
}


export function hazardPhase(time, offset = 0, type = 'steam') {
  const period = type === 'electric' ? 5.4 : 4.8;
  const activeWindow = type === 'electric' ? 0.72 : 0.9;
  const warningWindow = type === 'electric' ? 1.2 : 1.05;
  const phase = ((time + offset) % period + period) % period;
  const active = phase < activeWindow;
  const warning = phase > period - warningWindow;
  return {
    period,
    phase,
    active,
    warning,
    warningProgress: warning ? (phase - (period - warningWindow)) / warningWindow : 0,
    activeProgress: active ? phase / activeWindow : 0,
  };
}


const LOCOMOTION = Object.freeze({
  volt: Object.freeze({ stepRate: 3.75, stride: 1.08, bob: 0.9, lean: 1.18, twist: 1.08, dust: 0.9, hover: 0 }),
  spectre: Object.freeze({ stepRate: 3.05, stride: 0.82, bob: 0.48, lean: 0.72, twist: 0.62, dust: 0.55, hover: 0 }),
  hex: Object.freeze({ stepRate: 2.65, stride: 0.62, bob: 0.35, lean: 0.82, twist: 1.15, dust: 0.42, hover: 0.035 }),
  carla: Object.freeze({ stepRate: 3.35, stride: 0.92, bob: 0.62, lean: 0.96, twist: 0.9, dust: 0.68, hover: 0 }),
  bruno: Object.freeze({ stepRate: 3.55, stride: 1.02, bob: 0.78, lean: 1.02, twist: 0.86, dust: 0.82, hover: 0 }),
  colossus: Object.freeze({ stepRate: 2.5, stride: 1.18, bob: 1.35, lean: 0.58, twist: 0.48, dust: 1.35, hover: 0 }),
});

export function runnerLocomotionProfile(id) {
  return LOCOMOTION[id] || LOCOMOTION.volt;
}

export function damageWearPresentation(hpRatio, id = 'volt', time = 0) {
  const severity = clamp((0.42 - hpRatio) / 0.32, 0, 1);
  const heavy = id === 'colossus' ? 0.78 : id === 'spectre' ? 1.08 : 1;
  return {
    severity,
    smokeRate: severity * severity * (id === 'colossus' ? 2.2 : 1.6),
    sparkRate: severity * (id === 'volt' ? 3.2 : id === 'spectre' ? 1.2 : 1.8),
    posture: severity * (id === 'colossus' ? 0.06 : id === 'spectre' ? 0.11 : 0.09),
    jitter: severity * (0.012 + 0.006 * Math.sin(time * 13 + (id.length || 1))) * heavy,
    flicker: severity * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * (id === 'volt' ? 19 : 11)))),
  };
}

export function projectilePresentation(id, isSuper, progress = 0, melee = false) {
  const superMul = isSuper ? 1.22 : 1;
  if (id === 'spectre') return { shapeX: 0.42, shapeY: 0.42, shapeZ: 2.15 * superMul, pulseHz: 34, pulse: 0.025, trailGap: isSuper ? 0.012 : 0.019, trailScale: isSuper ? 1.45 : 0.92, light: 0.72, wake: 0.18 };
  if (id === 'volt') return { shapeX: 1.22, shapeY: 1.12, shapeZ: (0.88 + progress * 0.12) * superMul, pulseHz: 21, pulse: 0.09, trailGap: isSuper ? 0.019 : 0.03, trailScale: isSuper ? 2.2 : 1.7, light: 1.18, wake: 0.32 };
  if (id === 'carla-whip') return { shapeX: 0.34, shapeY: 0.3, shapeZ: 4.9, pulseHz: 18, pulse: 0.025, trailGap: 0.045, trailScale: 0.8, light: 0.48, wake: 0.12 };
  if (id === 'carla-dog') return { shapeX: 1, shapeY: 1, shapeZ: 1, pulseHz: 13, pulse: 0.02, trailGap: 0.035, trailScale: 1.15, light: 0.7, wake: 0.42 };
  if (id === 'bruno-ball' || id === 'bruno-mega') return { shapeX: 1, shapeY: 1, shapeZ: 1, pulseHz: 10, pulse: 0.018, trailGap: isSuper ? 0.018 : 0.04, trailScale: isSuper ? 2.1 : 1.05, light: isSuper ? 1.2 : 0.58, wake: isSuper ? 0.58 : 0.18 };
  if (id === 'colossus' || melee) return { shapeX: 1.5, shapeY: 0.72, shapeZ: 0.68 * superMul, pulseHz: 12, pulse: 0.035, trailGap: 0.05, trailScale: 1.75, light: 0.62, wake: 0.5 };
  return { shapeX: 1, shapeY: 1, shapeZ: 1.15 * superMul, pulseHz: 17, pulse: 0.055, trailGap: 0.035, trailScale: 1.4, light: 1, wake: 0.25 };
}

export function superBuildPresentation(id, progress) {
  const p = smoothstep(0, 1, clamp(progress, 0, 1));
  const profiles = {
    volt: { crouch: 0.07, weapon: 0.055, halo: 0.2, twist: 0.05, pulse: 15, light: 2.8 },
    spectre: { crouch: 0.035, weapon: 0.025, halo: 0.14, twist: -0.03, pulse: 22, light: 2.3 },
    hex: { crouch: 0.09, weapon: 0.04, halo: 0.24, twist: -0.11, pulse: 10, light: 3.1 },
    carla: { crouch: 0.08, weapon: 0.045, halo: 0.18, twist: -0.08, pulse: 12, light: 2.6 },
    bruno: { crouch: 0.12, weapon: 0.06, halo: 0.2, twist: 0.1, pulse: 9, light: 3.2 },
    colossus: { crouch: 0.16, weapon: 0.02, halo: 0.18, twist: 0.08, pulse: 7, light: 3.5 },
  };
  const b = profiles[id] || profiles.volt;
  return {
    progress: p,
    crouch: b.crouch * p,
    weaponScale: 1 + b.weapon * p,
    halo: b.halo * p,
    twist: b.twist * p,
    pulseHz: b.pulse,
    light: b.light * p,
  };
}
