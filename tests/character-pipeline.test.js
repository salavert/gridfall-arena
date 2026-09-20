import assert from 'node:assert/strict';
import test from 'node:test';
import {
  UBC_JOINTS,
  UBC_SOCKETS,
  assertRigJointNames,
  diffRigJointNames,
  scaleForTargetHeight,
} from '../src/characters/characterRig.js';
import { CHARACTER_PIPELINE } from '../src/characters/characterManifest.js';

test('UBC rig contract is stable and contains every gameplay socket', () => {
  assert.equal(UBC_JOINTS.length, 65);
  assert.equal(new Set(UBC_JOINTS).size, UBC_JOINTS.length);
  for (const socket of Object.values(UBC_SOCKETS)) assert.ok(UBC_JOINTS.includes(socket));
  assert.doesNotThrow(() => assertRigJointNames(UBC_JOINTS));
});

test('rig validation reports missing and extra joints without accepting a partial skeleton', () => {
  const names = UBC_JOINTS.filter(name => name !== 'hand_r').concat('custom_socket');
  const diff = diffRigJointNames(names);
  assert.deepEqual(diff.missing, ['hand_r']);
  assert.deepEqual(diff.extra, ['custom_socket']);
  assert.throws(() => assertRigJointNames(names), /hand_r/);
});

test('character height normalization is explicit and bounded by positive inputs', () => {
  assert.equal(scaleForTargetHeight(2, 1.5), 0.75);
  assert.throws(() => scaleForTargetHeight(0, 1.5), RangeError);
  assert.throws(() => scaleForTargetHeight(1.5, 0), RangeError);
});

test('Carla and Bruno remain authoring targets with procedural fallback until GLBs exist', () => {
  assert.equal(CHARACTER_PIPELINE.runtime.fallback, 'procedural-runner');
  assert.equal(CHARACTER_PIPELINE.characters.carla.runtimeAsset, null);
  assert.equal(CHARACTER_PIPELINE.characters.bruno.runtimeAsset, null);
  assert.equal(CHARACTER_PIPELINE.characters.carla.rightHandProp, 'whip');
  assert.equal(CHARACTER_PIPELINE.characters.carla.companion, 'border-collie');
  assert.ok(CHARACTER_PIPELINE.characters.bruno.customClips.includes('super_power_kick'));
});

test('rigged character loader is available without adding another Three dependency', async () => {
  const module = await import('../src/characters/CharacterAssetLoader.js');
  assert.equal(typeof module.CharacterAssetLoader, 'function');
});
