const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const ROLES = Object.freeze({
  volt: Object.freeze({ preferred: 3.6, strafe: 1.05, cover: 0.35, flank: 0.9, aggression: 0.72, objective: 0.55 }),
  spectre: Object.freeze({ preferred: 7.0, strafe: 0.58, cover: 1.0, flank: 0.35, aggression: 0.42, objective: 0.35 }),
  hex: Object.freeze({ preferred: 5.7, strafe: 0.9, cover: 0.72, flank: 0.62, aggression: 0.5, objective: 0.68 }),
  colossus: Object.freeze({ preferred: 1.55, strafe: 0.2, cover: -0.25, flank: 0.18, aggression: 1.0, objective: 0.82 }),
});

export function roleTactics(id) {
  return ROLES[id] || ROLES.volt;
}

export function aiMood({ hpRatio, targetHpRatio = 1, cubes = 0, kills = 0, recentlyHit = false, finalDuel = false }) {
  if (finalDuel) return hpRatio < 0.34 && targetHpRatio > hpRatio + 0.08 ? 'desperate' : 'duel';
  if (hpRatio < 0.28 && targetHpRatio > hpRatio + 0.04) return 'retreat';
  if (hpRatio < 0.42 && recentlyHit && targetHpRatio > hpRatio + 0.12) return 'cautious';
  if (cubes >= 4 || kills >= 2 || targetHpRatio < 0.3) return 'press';
  return 'steady';
}

export function tacticalPointScore({ role, distance, cover = 0, lineOfSight = false, flank = 0, danger = 0 }) {
  const preferred = Math.max(0.5, role.preferred);
  const distanceError = Math.abs(distance - preferred) / preferred;
  return (
    4.2 -
    distanceError * 2.5 +
    cover * role.cover +
    Number(lineOfSight) * (role === ROLES.hex ? 0.35 : 1.0) +
    flank * role.flank -
    danger * 3.2
  );
}

export function objectiveInterest({ active, distance, mood = 'steady', cubes = 0, hasTarget = false }) {
  if (!active || mood === 'retreat' || mood === 'cautious') return 0;
  const distanceFactor = clamp(1 - distance / 18, 0, 1);
  const targetPenalty = hasTarget ? 0.35 : 1;
  const powerNeed = clamp(1 - cubes / 7, 0.35, 1);
  const moodBoost = mood === 'press' ? 0.82 : mood === 'duel' ? 0.2 : 1;
  return distanceFactor * targetPenalty * powerNeed * moodBoost;
}
