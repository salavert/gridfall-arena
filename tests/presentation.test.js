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


test('core power presentation grows quickly then saturates without runaway scale', async () => {
  const { corePowerPresentation } = await import('../src/presentation/combat.js');
  const zero = corePowerPresentation(0);
  const three = corePowerPresentation(3);
  const ten = corePowerPresentation(10);
  assert.equal(zero.auraOpacity, 0);
  assert.ok(three.power > 0.4);
  assert.ok(ten.power > three.power && ten.power < 1);
  assert.ok(ten.weaponScale < 1.05);
  assert.ok(ten.auraScale < 1.25);
});


test('destruction profiles keep persistent wreckage bounded by material', async () => {
  const { destructionProfile } = await import('../src/presentation/combat.js');
  const stone = destructionProfile('stone', 1.4);
  const foliage = destructionProfile('foliage', 1);
  assert.ok(stone.debris > foliage.debris);
  assert.ok(stone.persist > foliage.persist);
  assert.equal(stone.scar, 'crack');
  assert.equal(foliage.scar, null);
  assert.ok(stone.velocity < 1.6);
});

test('each super leaves a distinct semantic scar and temporary field', async () => {
  const { superScarProfile } = await import('../src/presentation/combat.js');
  const volt = superScarProfile('volt');
  const spectre = superScarProfile('spectre');
  const hex = superScarProfile('hex');
  const colossus = superScarProfile('colossus');
  assert.deepEqual(
    [volt.type, spectre.type, hex.type, colossus.type],
    ['electric', 'slash', 'rift', 'crack'],
  );
  assert.ok(spectre.aspect > 2);
  assert.ok(hex.zoneLife > volt.zoneLife);
  assert.ok(colossus.size > volt.size);
});


test('arena zones provide distinct material and atmosphere identities', async () => {
  const { arenaZoneProfile } = await import('../src/presentation/combat.js');
  assert.equal(arenaZoneProfile(-10.5, -10.5).surface, 'dirt');
  assert.equal(arenaZoneProfile(10.5, -10.5).surface, 'metal');
  assert.equal(arenaZoneProfile(-10.5, 10.5).surface, 'stone');
  assert.equal(arenaZoneProfile(10.5, 10.5).surface, 'foliage');
  assert.equal(arenaZoneProfile(0, 0).surface, 'ground');
});

test('contact shadows stay grounded and compress as height increases', async () => {
  const { contactShadowPresentation } = await import('../src/presentation/combat.js');
  const grounded = contactShadowPresentation({ speed: 3, maxSpeed: 3, height: 0, sideSpeed: 0.5, anticipation: 0.6 });
  const airborne = contactShadowPresentation({ speed: 3, maxSpeed: 3, height: 2.8, sideSpeed: 0.5, anticipation: 0.6 });
  assert.ok(grounded.opacity > airborne.opacity);
  assert.ok(grounded.length > airborne.length);
  assert.ok(grounded.width > airborne.width);
});

test('incoming projectile threat rejects misses and prioritizes imminent supers', async () => {
  const { incomingProjectileThreat } = await import('../src/presentation/combat.js');
  assert.equal(incomingProjectileThreat({ along: -1, cross: 0.1, speed: 15 }), null);
  assert.equal(incomingProjectileThreat({ along: 5, cross: 2, speed: 15 }), null);
  const normal = incomingProjectileThreat({ along: 5, cross: 0.35, speed: 15 });
  const superShot = incomingProjectileThreat({ along: 4, cross: 0.25, speed: 15, isSuper: true });
  assert.ok(normal);
  assert.ok(superShot.priority > normal.priority);
});


test('hazards expose warning before a short active window', async () => {
  const { hazardPhase } = await import('../src/presentation/combat.js');
  const active = hazardPhase(0, 0, 'steam');
  const idle = hazardPhase(2.2, 0, 'steam');
  const warning = hazardPhase(4.2, 0, 'steam');
  assert.equal(active.active, true);
  assert.equal(idle.active, false);
  assert.equal(idle.warning, false);
  assert.equal(warning.warning, true);
  assert.ok(warning.warningProgress > 0);
});


test('runner locomotion profiles are visibly distinct', async () => {
  const { runnerLocomotionProfile } = await import('../src/presentation/combat.js');
  const volt = runnerLocomotionProfile('volt');
  const spectre = runnerLocomotionProfile('spectre');
  const hex = runnerLocomotionProfile('hex');
  const colossus = runnerLocomotionProfile('colossus');
  assert.ok(volt.stepRate > spectre.stepRate);
  assert.ok(colossus.bob > spectre.bob);
  assert.ok(hex.hover > 0);
  assert.ok(colossus.dust > volt.dust);
});

test('damage wear stays subtle until health becomes critical', async () => {
  const { damageWearPresentation } = await import('../src/presentation/combat.js');
  const healthy = damageWearPresentation(0.9, 'volt', 1);
  const critical = damageWearPresentation(0.15, 'volt', 1);
  assert.equal(healthy.severity, 0);
  assert.ok(critical.severity > 0.8);
  assert.ok(critical.sparkRate > healthy.sparkRate);
});

test('projectile silhouettes identify rail, electric and melee families', async () => {
  const { projectilePresentation } = await import('../src/presentation/combat.js');
  const rail = projectilePresentation('spectre', false, 0.5, false);
  const volt = projectilePresentation('volt', false, 0.5, false);
  const melee = projectilePresentation('colossus', false, 0.5, true);
  assert.ok(rail.shapeZ > volt.shapeZ);
  assert.ok(rail.shapeX < volt.shapeX);
  assert.ok(melee.shapeX > volt.shapeX);
});

test('super buildup has runner-specific posture and pulse', async () => {
  const { superBuildPresentation } = await import('../src/presentation/combat.js');
  const hex = superBuildPresentation('hex', 1);
  const colossus = superBuildPresentation('colossus', 1);
  const spectre = superBuildPresentation('spectre', 1);
  assert.ok(colossus.crouch > spectre.crouch);
  assert.ok(hex.halo > spectre.halo);
  assert.notEqual(hex.pulseHz, colossus.pulseHz);
});
