import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME } from '../src/config.js';
import { collapseRadius, weaponLevelForShards } from '../src/core/rules.js';

test('weapon upgrades happen every three shards and cap at MK III', () => {
  assert.equal(weaponLevelForShards(0), 1);
  assert.equal(weaponLevelForShards(3), 2);
  assert.equal(weaponLevelForShards(6), 3);
  assert.equal(weaponLevelForShards(99), 3);
});

test('grid radius is stable before collapse and bounded afterwards', () => {
  assert.equal(collapseRadius(0, GAME), GAME.arenaSize * 0.72);
  assert.equal(collapseRadius(GAME.collapseStart, GAME), GAME.arenaSize * 0.72);
  assert.ok(collapseRadius(GAME.collapseStart + 20, GAME) < GAME.arenaSize * 0.72);
  assert.ok(Math.abs(collapseRadius(999, GAME) - 5.3) < Number.EPSILON * 8);
});
