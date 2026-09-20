#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import {
  SIDEKICK_REQUIRED_ROLES,
  assertHumanoidRig,
  missingHumanoidRoles,
  resolveHumanoidRig,
} from '../src/characters/characterRig.js';

function readDocument(filename) {
  const bytes = readFileSync(filename);
  if (extname(filename).toLowerCase() === '.gltf') {
    return JSON.parse(bytes.toString('utf8'));
  }
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('Expected a .gltf JSON file or GLB v2 file');
  }
  const version = bytes.readUInt32LE(4);
  if (version !== 2) throw new Error(`Unsupported GLB version: ${version}`);
  const jsonLength = bytes.readUInt32LE(12);
  const chunkType = bytes.toString('ascii', 16, 20);
  if (chunkType !== 'JSON') throw new Error('First GLB chunk is not JSON');
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trimEnd());
}

function triangleCount(document) {
  let total = 0;
  for (const mesh of document.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.mode !== undefined && primitive.mode !== 4) continue;
      if (primitive.indices !== undefined) {
        total += Math.floor((document.accessors?.[primitive.indices]?.count ?? 0) / 3);
      } else {
        const positions = primitive.attributes?.POSITION;
        total += Math.floor((document.accessors?.[positions]?.count ?? 0) / 3);
      }
    }
  }
  return total;
}

function morphTargetCount(document) {
  let count = 0;
  for (const mesh of document.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      count = Math.max(count, primitive.targets?.length ?? 0);
    }
  }
  return count;
}

function inspect(document) {
  const jointIndexes = new Set((document.skins ?? []).flatMap(skin => skin.joints ?? []));
  const jointNames = [...jointIndexes]
    .map(index => document.nodes?.[index]?.name)
    .filter(Boolean);
  const humanoidRig = resolveHumanoidRig(jointNames);
  return {
    nodes: document.nodes?.length ?? 0,
    meshes: document.meshes?.length ?? 0,
    skins: document.skins?.length ?? 0,
    joints: jointNames.length,
    materials: document.materials?.length ?? 0,
    textures: document.textures?.length ?? 0,
    animations: (document.animations ?? []).map(animation => animation.name ?? ''),
    morphTargets: morphTargetCount(document),
    triangles: triangleCount(document),
    jointNames,
    humanoidRig,
    missingHumanoidRoles: missingHumanoidRoles(jointNames),
  };
}

const filename = process.argv[2];
if (!filename) {
  console.error(
    'Usage: node scripts/inspect-character.mjs <character.glb|character.gltf> [--verify-sidekick]',
  );
  process.exit(2);
}

const result = inspect(readDocument(resolve(filename)));
console.log(JSON.stringify(result, null, 2));

if (process.argv.includes('--verify-sidekick')) {
  if (result.skins < 1) {
    console.error('Sidekick candidate must contain at least one skin');
    process.exit(1);
  }
  try {
    assertHumanoidRig(result.jointNames, SIDEKICK_REQUIRED_ROLES);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
