import { UBC_JOINTS, UBC_SOCKETS } from './characterRig.js';

export const CHARACTER_PIPELINE = Object.freeze({
  family: 'gridfall-humanoid-v1',
  sourceRig: 'Quaternius Universal Base Characters',
  sourceLicense: 'CC0-1.0',
  sourceUrl: 'https://quaternius.com/packs/universalbasecharacters.html',
  animationSourceUrl: 'https://quaternius.com/packs/universalanimationlibrary.html',
  runtime: Object.freeze({
    units: 'meters',
    upAxis: '+Y',
    gameplayForwardAxis: '+Z',
    feetAtY: 0,
    targetHeight: 1.42,
    worldPositionOwner: 'simulation',
    rootMotion: false,
    fallback: 'procedural-runner',
  }),
  rig: Object.freeze({
    jointCount: UBC_JOINTS.length,
    joints: UBC_JOINTS,
    sockets: UBC_SOCKETS,
  }),
  shippingBudget: Object.freeze({
    maxTriangles: 18000,
    maxMaterials: 4,
    maxTextures: 6,
    maxTextureDimension: 1024,
    maxCharacterBytes: 2500000,
  }),
  commonClips: Object.freeze({
    idle: 'Idle_Loop',
    jog: 'Jog_Fwd_Loop',
    sprint: 'Sprint_Loop',
    hurt: null,
    defeat: null,
  }),
  characters: Object.freeze({
    carla: Object.freeze({
      runtimeAsset: null,
      status: 'authoring-required',
      body: 'female-child',
      hair: 'straight-light-brown-with-blonde-fringe-streak',
      rightHandProp: 'whip',
      companion: 'border-collie',
      customClips: Object.freeze(['attack_whip', 'super_collie_command', 'victory']),
    }),
    bruno: Object.freeze({
      runtimeAsset: null,
      status: 'authoring-required',
      body: 'male-child',
      hair: 'short-messy-brown',
      rightHandProp: null,
      companion: null,
      customClips: Object.freeze(['attack_kick', 'super_power_kick', 'victory']),
    }),
  }),
});
