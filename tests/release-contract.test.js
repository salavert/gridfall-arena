import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('v0.2 ships the complete Gridfall identity and roster', () => {
  for (const marker of [
    '<title>Gridfall Arena</title>',
    'GRIDFALL<span>ARENA</span>',
    'name:`VOLT`',
    'name:`SPECTRE`',
    'name:`HEX`',
    'name:`COLOSSUS`',
    'OVERDRIVE',
    'THE VOID IS COLLAPSING THE GRID!',
  ]) {
    assert.ok(html.includes(marker), `missing release marker: ${marker}`);
  }
});

test('legacy player-facing branding is absent', () => {
  for (const legacy of [
    'SUNDOWN SHOWDOWN',
    'BRAWLERS LEFT',
    'POISON GAS IS CLOSING IN!',
    'sundown-showdown-settings',
  ]) {
    assert.equal(html.includes(legacy), false, `legacy marker remains: ${legacy}`);
  }
});

test('production page retains the full rendering and game systems', () => {
  for (const subsystem of [
    'GTAOPass',
    'UnrealBloomPass',
    'shadowMap',
    'gasDuration:115',
    'addBrawler',
    'spawnRoster',
    'benchmarkQuality',
    'touchMode',
  ]) {
    assert.ok(html.includes(subsystem), `missing subsystem: ${subsystem}`);
  }
});
