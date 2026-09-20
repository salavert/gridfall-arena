#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { UBC_JOINTS, diffRigJointNames } from '../src/characters/characterRig.js';

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

function inspect(document) {
  const jointIndexes = new Set((document.skins ?? []).flatMap(skin => skin.joints ?? []));
  const joints = [...jointIndexes].map(index => document.nodes?.[index]?.name).filter(Boolean);
  return {
    nodes: document.nodes?.length ?? 0,
    meshes: document.meshes?.length ?? 0,
    skins: document.skins?.length ?? 0,
    joints: joints.length,
    materials: document.materials?.length ?? 0,
    textures: document.textures?.length ?? 0,
    animations: (document.animations ?? []).map(animation => animation.name ?? ''),
    triangles: triangleCount(document),
    jointNames: joints,
    ubcRig: diffRigJointNames(joints),
  };
}

const filename = process.argv[2];
if (!filename) {
  console.error('Usage: node scripts/inspect-character.mjs <character.glb|character.gltf> [--verify-ubc]');
  process.exit(2);
}
const result = inspect(readDocument(resolve(filename)));
console.log(JSON.stringify(result, null, 2));

if (process.argv.includes('--verify-ubc')) {
  if (result.ubcRig.missing.length) process.exit(1);
  if (result.joints !== UBC_JOINTS.length) {
    console.error(`Expected ${UBC_JOINTS.length} UBC joints, found ${result.joints}`);
    process.exit(1);
  }
}
