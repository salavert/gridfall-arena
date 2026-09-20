import test from 'node:test';
import assert from 'node:assert/strict';
import { aiMood, roleTactics, tacticalPointScore, objectiveInterest } from '../src/game/ai.js';

test('AI moods react to health, momentum and final duel pressure', () => {
  assert.equal(aiMood({ hpRatio: 0.2, targetHpRatio: 0.8 }), 'retreat');
  assert.equal(aiMood({ hpRatio: 0.8, targetHpRatio: 0.2, cubes: 4 }), 'press');
  assert.equal(aiMood({ hpRatio: 0.7, targetHpRatio: 0.7, finalDuel: true }), 'duel');
  assert.equal(aiMood({ hpRatio: 0.2, targetHpRatio: 0.7, finalDuel: true }), 'desperate');
});

test('role tactics create distinct preferred combat geometry', () => {
  assert.ok(roleTactics('spectre').preferred > roleTactics('volt').preferred);
  assert.ok(roleTactics('colossus').aggression > roleTactics('hex').aggression);
  assert.ok(roleTactics('spectre').cover > roleTactics('colossus').cover);
  assert.ok(roleTactics('carla').flank > roleTactics('spectre').flank);
  assert.ok(roleTactics('bruno').objective > roleTactics('volt').objective);
});

test('tactical points reward role-appropriate range and safety', () => {
  const role = roleTactics('spectre');
  const good = tacticalPointScore({ role, distance: 7, cover: 2, lineOfSight: true, flank: 0.2, danger: 0 });
  const bad = tacticalPointScore({ role, distance: 2, cover: 0, lineOfSight: false, flank: 0, danger: 1 });
  assert.ok(good > bad);
});

test('objective interest drops when retreating or already fighting', () => {
  const open = objectiveInterest({ active: true, distance: 5, mood: 'steady', cubes: 0, hasTarget: false });
  const fighting = objectiveInterest({ active: true, distance: 5, mood: 'steady', cubes: 0, hasTarget: true });
  const retreat = objectiveInterest({ active: true, distance: 5, mood: 'retreat', cubes: 0, hasTarget: false });
  assert.ok(open > fighting);
  assert.equal(retreat, 0);
});
