import test from 'node:test';
import assert from 'node:assert/strict';
import { circleIntersectsBox, clamp, formatTime, mulberry32, normalize2 } from '../src/core/math.js';

test('clamp keeps values inside a range', () => {
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(4, 0, 10), 4);
});

test('formatTime is stable at boundaries', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(61.9), '01:01');
  assert.equal(formatTime(-1), '00:00');
});

test('seeded random produces repeatable arenas', () => {
  const first = mulberry32(41814);
  const second = mulberry32(41814);
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
});

test('circle to box collision handles contact and separation', () => {
  const box = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
  assert.equal(circleIntersectsBox(1.4, 0, 0.5, box), true);
  assert.equal(circleIntersectsBox(2, 0, 0.5, box), false);
});

test('normalize2 handles zero without NaN', () => {
  assert.deepEqual(normalize2(0, 0), { x: 0, z: 0, length: 0 });
  const value = normalize2(3, 4);
  assert.equal(value.length, 5);
  assert.equal(value.x, 0.6);
  assert.equal(value.z, 0.8);
});
