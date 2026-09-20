import {
  SIDEKICK_REQUIRED_ROLES,
  SIDEKICK_SOCKETS,
} from './characterRig.js';

export const CHARACTER_PIPELINE = Object.freeze({
  family: 'syntysidekick-v1',
  source: Object.freeze({
    vendor: 'Synty Studios',
    product: 'Sidekick Modern Civilians',
    url: 'https://syntystore.com/products/modern-civilians-sidekick-modular-characters',
    licence: 'Synty One-Time Purchase Licence',
  }),
  assetPolicy: Object.freeze({
    licensedSourceDir: '.licensed/sidekick',
    runtimeDir: 'public/assets/licensed/sidekick',
    commitLicensedAssets: false,
    webDistribution: 'pending-vendor-confirmation',
  }),
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
    standard: 'Unity Humanoid / Mecanim compatible',
    requiredRoles: SIDEKICK_REQUIRED_ROLES,
    sockets: SIDEKICK_SOCKETS,
  }),
  shippingBudget: Object.freeze({
    maxTriangles: 50000,
    maxMaterials: 6,
    maxTextures: 8,
    maxTextureDimension: 1024,
    maxCharacterBytes: 5000000,
  }),
  characters: Object.freeze({
    carla: Object.freeze({
      runtimeAsset: './assets/licensed/sidekick/carla.glb',
      status: 'awaiting-licensed-export',
      silhouette: 'young-short-slim',
      hair: 'straight-light-brown-with-blonde-fringe-streak',
      rightHandProp: 'whip',
      companion: 'border-collie',
      expressionProfile: 'confident-friendly',
    }),
    bruno: Object.freeze({
      runtimeAsset: './assets/licensed/sidekick/bruno.glb',
      status: 'awaiting-licensed-export',
      silhouette: 'young-average-sporty',
      hair: 'short-messy-brown',
      rightHandProp: null,
      companion: null,
      expressionProfile: 'energetic-competitive',
    }),
  }),
});
