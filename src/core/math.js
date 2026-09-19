export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, speed, dt) => lerp(current, target, 1 - Math.exp(-speed * dt));
export const distanceSq = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;

export function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRange(random, min, max) {
  return min + random() * (max - min);
}

export function circleIntersectsBox(x, z, radius, box) {
  const nearestX = clamp(x, box.minX, box.maxX);
  const nearestZ = clamp(z, box.minZ, box.maxZ);
  return distanceSq(x, z, nearestX, nearestZ) < radius * radius;
}

export function normalize2(x, z) {
  const length = Math.hypot(x, z);
  return length > 0.0001 ? { x: x / length, z: z / length, length } : { x: 0, z: 0, length: 0 };
}
