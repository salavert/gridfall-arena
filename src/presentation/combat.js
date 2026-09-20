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
    colossus: { type: 'crack', decalColor: 0x342b27, aspect: 1.45, life: 66, peak: 0.56, zoneLife: 3.2, zoneAspect: 1.35 },
  };
  const base = profiles[id] || profiles.volt;
  return {
    ...base,
    size: (id === 'spectre' ? 0.24 : id === 'colossus' ? 0.5 : id === 'hex' ? 0.42 : 0.3) * p,
    zoneScale: (id === 'spectre' ? 0.85 : id === 'colossus' ? 1.2 : id === 'hex' ? 1.05 : 0.9) * p,
  };
}
