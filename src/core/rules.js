import { clamp, lerp } from './math.js';

export function weaponLevelForShards(shards) {
  return Math.min(3, 1 + Math.floor(Math.max(0, shards) / 3));
}

export function collapseRadius(matchTime, config) {
  if (matchTime <= config.collapseStart) return config.arenaSize * 0.72;
  const progress = clamp((matchTime - config.collapseStart) / config.collapseDuration, 0, 1);
  return lerp(config.arenaSize * 0.72, 5.3, progress ** 1.08);
}
