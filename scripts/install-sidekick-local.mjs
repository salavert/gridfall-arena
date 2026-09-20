#!/usr/bin/env node
import { access, copyFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const inputDir = resolve(process.argv[2] ?? '.licensed/sidekick/input');
const outputDir = resolve('public/assets/licensed/sidekick');
const characters = ['carla', 'bruno'];

await mkdir(outputDir, { recursive: true });

for (const id of characters) {
  const source = resolve(inputDir, `${id}.glb`);
  const target = resolve(outputDir, `${id}.glb`);

  await access(source);

  const validation = spawnSync(
    process.execPath,
    ['scripts/inspect-character.mjs', source, '--verify-sidekick'],
    { stdio: 'inherit' },
  );
  if (validation.status !== 0) {
    process.exit(validation.status ?? 1);
  }

  await copyFile(source, target);
  console.log(`[sidekick] installed ${id}: ${target}`);
}

console.log('[sidekick] licensed assets are installed locally and remain gitignored');
