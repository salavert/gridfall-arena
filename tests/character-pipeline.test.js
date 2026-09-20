import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SIDEKICK_REQUIRED_ROLES,
  SIDEKICK_SOCKETS,
  assertHumanoidRig,
  missingHumanoidRoles,
  normalizeBoneName,
  resolveHumanoidRig,
  scaleForTargetHeight,
} from '../src/characters/characterRig.js';
import { CHARACTER_PIPELINE } from '../src/characters/characterManifest.js';

const UNITY_HUMANOID = [
  'Root',
  'Hips',
  'Spine',
  'Chest',
  'Neck',
  'Head',
  'LeftShoulder',
  'LeftUpperArm',
  'LeftLowerArm',
  'LeftHand',
  'RightShoulder',
  'RightUpperArm',
  'RightLowerArm',
  'RightHand',
  'LeftUpperLeg',
  'LeftLowerLeg',
  'LeftFoot',
  'RightUpperLeg',
  'RightLowerLeg',
  'RightFoot',
];

test('Sidekick rig validation resolves Unity Humanoid roles', () => {
  assert.deepEqual(missingHumanoidRoles(UNITY_HUMANOID), []);
  assert.doesNotThrow(() => assertHumanoidRig(UNITY_HUMANOID));
  const resolved = resolveHumanoidRig(UNITY_HUMANOID);
  for (const socketRole of Object.values(SIDEKICK_SOCKETS)) {
    assert.ok(resolved[socketRole]);
  }
});

test('Sidekick rig resolver tolerates namespaces and vendor prefixes', () => {
  const names = UNITY_HUMANOID.map(name => `SK_Modern:Character_${name}`);
  const resolved = resolveHumanoidRig(names);
  assert.equal(resolved.hips, 'SK_Modern:Character_Hips');
  assert.equal(resolved.rightHand, 'SK_Modern:Character_RightHand');
  assert.equal(normalizeBoneName('SK_Modern:Character_RightHand'), 'characterrighthand');
  assert.deepEqual(missingHumanoidRoles(names), []);
});

test('Sidekick rig validation rejects incomplete deformation skeletons', () => {
  const names = UNITY_HUMANOID.filter(name => name !== 'RightHand');
  assert.deepEqual(missingHumanoidRoles(names), ['rightHand']);
  assert.throws(() => assertHumanoidRig(names), /rightHand/);
});

test('character height normalization remains presentation-only and explicit', () => {
  assert.equal(scaleForTargetHeight(2, 1.5), 0.75);
  assert.throws(() => scaleForTargetHeight(0, 1.5), RangeError);
  assert.throws(() => scaleForTargetHeight(1.5, 0), RangeError);
});

test('Sidekick assets stay licensed, local and outside the public repository', () => {
  assert.equal(CHARACTER_PIPELINE.family, 'syntysidekick-v1');
  assert.equal(CHARACTER_PIPELINE.assetPolicy.commitLicensedAssets, false);
  assert.equal(CHARACTER_PIPELINE.assetPolicy.webDistribution, 'pending-vendor-confirmation');
  assert.equal(CHARACTER_PIPELINE.runtime.fallback, 'procedural-runner');
  assert.equal(CHARACTER_PIPELINE.characters.carla.rightHandProp, 'whip');
  assert.equal(CHARACTER_PIPELINE.characters.carla.companion, 'border-collie');
  assert.ok(SIDEKICK_REQUIRED_ROLES.includes('hips'));
});

test('rigged character loader remains available through the existing Three dependency', async () => {
  const module = await import('../src/characters/CharacterAssetLoader.js');
  assert.equal(typeof module.CharacterAssetLoader, 'function');
});
