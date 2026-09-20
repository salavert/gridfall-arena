import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES, SURFACES, classifyImpactSurface } from '../src/game/config.js';
import { combatIntensity, nearMissPresentation, duelCameraFrame, feedbackBands } from '../src/presentation/combat.js';

test('impact surfaces map world tiles to presentation materials', () => {
  assert.equal(classifyImpactSurface(TILES.WATER, 0), 'water');
  assert.equal(classifyImpactSurface(TILES.BUSH, 0), 'foliage');
  assert.equal(classifyImpactSurface(TILES.WALL, SURFACES.CRATE), 'wood');
  assert.equal(classifyImpactSurface(TILES.WALL, SURFACES.BARREL), 'metal');
  assert.equal(classifyImpactSurface(TILES.WALL, SURFACES.STONE), 'stone');
  assert.equal(classifyImpactSurface(TILES.EMPTY, 0), 'ground');
});

test('combat presentation scales monotonically for heavy player-facing events', () => {
  const light = combatIntensity({ damage: 200, kind: 'spread' });
  const heavy = combatIntensity({ damage: 1800, kind: 'melee', isSuper: true, isKill: true, playerInvolved: true });
  assert.ok(light >= 0.1 && light < heavy);
  assert.ok(heavy <= 1);
  const bands = feedbackBands(heavy);
  assert.ok(bands.heavy <= bands.medium && bands.medium <= bands.light);
});

test('near misses and final-duel framing remain bounded and stronger for supers', () => {
  const normal = nearMissPresentation(0.9, false);
  const superMiss = nearMissPresentation(0.45, true);
  assert.ok(superMiss.strength > normal.strength);
  assert.ok(superMiss.combatZoom < 0.03);
  const frame = duelCameraFrame(6, -2, 8);
  assert.equal(frame.biasX, 1.32);
  assert.equal(frame.biasZ, -0.44);
  assert.ok(frame.zoom > 0.012 && frame.zoom < 0.05);
});


test('movement pose distinguishes forward drive, strafe and hard turns', async () => {
  const { movementPose } = await import('../src/presentation/combat.js');
  const forward = movementPose({ speed: 3, maxSpeed: 3, forwardSpeed: 3, sideSpeed: 0, angularSpeed: 0 });
  const strafe = movementPose({ speed: 3, maxSpeed: 3, forwardSpeed: 0, sideSpeed: 3, angularSpeed: 0 });
  const turn = movementPose({ speed: 3, maxSpeed: 3, forwardSpeed: 2, sideSpeed: 0, angularSpeed: 8 });
  assert.ok(forward.forwardLean > 0.08);
  assert.ok(strafe.sideLean > 0.12);
  assert.ok(Math.abs(turn.torsoTwist) > 0.05);
});

test('attack intent and hit reaction encode readable silhouettes', async () => {
  const { attackIntentPose, hitReactionPose } = await import('../src/presentation/combat.js');
  const ranged = attackIntentPose('spread', 1, false);
  const meleeSuper = attackIntentPose('melee', 1, true);
  assert.ok(meleeSuper.windup > ranged.windup);
  assert.ok(meleeSuper.plant > ranged.plant);
  const leftHit = hitReactionPose(Math.PI / 2, true);
  const frontHit = hitReactionPose(0, true);
  assert.ok(leftHit.tilt > 0.2);
  assert.ok(Math.abs(frontHit.pitch) > 0.15);
});
