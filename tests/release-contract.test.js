import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { RULES, RUNNERS } from '../src/game/config.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../src/runtime.js', import.meta.url), 'utf8');
const subsystemNames = ["Renderer.js","Lighting.js","Arena.js","Runner.js","Combat.js","Effects.js","Void.js","AI.js","Input.js","Hud.js","Game.js"];
const kernel = await readFile(new URL('../public/runtime/kernel.js', import.meta.url), 'utf8');
const subsystems = await Promise.all(subsystemNames.map(name => readFile(new URL('../public/runtime/' + name, import.meta.url), 'utf8')));
const production = [html, runtime, kernel, ...subsystems].join('\n');

test('v0.3 ships the complete Gridfall identity and roster', () => {
  for (const marker of [
    '<title>Gridfall Arena</title>',
    'GRIDFALL<span>ARENA</span>',
    'OVERDRIVE',
    'THE VOID IS COLLAPSING THE GRID!',
  ]) {
    assert.ok(production.includes(marker), `missing release marker: ${marker}`);
  }
  assert.deepEqual(Object.keys(RUNNERS), ['volt', 'spectre', 'hex', 'colossus']);
  assert.deepEqual(Object.values(RUNNERS).map(runner => runner.name), ['VOLT', 'SPECTRE', 'HEX', 'COLOSSUS']);
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
    'addBrawler',
    'spawnRoster',
    'benchmarkQuality',
    'touchMode',
  ]) {
    assert.ok(production.includes(subsystem), `missing subsystem: ${subsystem}`);
  }
  assert.equal(RULES.gasDuration, 115);
});


test('production HTML delegates runtime to a module', () => {
  assert.match(html, /src=["']\.\/src\/runtime\.js["']/);
  assert.ok(html.length < 120000, 'index.html should remain a document/bootstrap, not the game engine');
  assert.ok(runtime.length < 15000, 'runtime.js should remain a bootstrap/orchestrator');
  assert.ok(kernel.length > 500000, 'embedded Three kernel should be isolated from game systems');
  assert.equal(subsystems.length, 11);
});


test('production systems are physically separated from the bootstrap', () => {
  for (const name of ['Renderer.js','Lighting.js','Arena.js','Runner.js','Combat.js','Effects.js','AI.js','Input.js','Hud.js','Game.js']) {
    assert.ok(subsystemNames.includes(name), `missing production subsystem file: ${name}`);
  }
  for (const marker of ['globalThis.Zl=class','globalThis.fu=class','globalThis.Su=class','globalThis.Nu=class','globalThis.Vu=class','globalThis.Yu=class','globalThis.ld=class']) {
    assert.ok(production.includes(marker), `missing extracted class marker: ${marker}`);
  }
});
