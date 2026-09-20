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
