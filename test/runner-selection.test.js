import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { Vector3, PerspectiveCamera } from 'three';
import { RUNNERS } from '../src/game/config.js';
import { RUNNER_IDS, selectedRunnerIndex, nextRunnerId, menuKeyAction, runnerStats } from '../src/presentation/runnerSelection.js';
import { FrontEndDirector } from '../src/presentation/FrontEndDirector.js';

test('ordered runner selection wraps in either direction, including a 2x2 row', () => {
  assert.deepEqual(RUNNER_IDS, ['volt', 'spectre', 'hex', 'colossus']);
  for (const [index, id] of RUNNER_IDS.entries()) {
    assert.equal(selectedRunnerIndex(id), index);
    assert.equal(nextRunnerId(id, 1), RUNNER_IDS[(index + 1) % 4]);
    assert.equal(nextRunnerId(id, -1), RUNNER_IDS[(index + 3) % 4]);
    assert.equal(nextRunnerId(id, 2), RUNNER_IDS[(index + 2) % 4]);
    assert.equal(nextRunnerId(id, -2), nextRunnerId(id, 2));
  }
  assert.equal(selectedRunnerIndex('stale-id'), 0);
  assert.equal(nextRunnerId('stale-id', 1), 'spectre');
  assert.equal(nextRunnerId('volt', -9), 'colossus');
});

test('menu keys support physical keys, fallbacks, two rows and browser shortcuts', () => {
  for (const code of ['ArrowLeft', 'KeyA']) assert.deepEqual(menuKeyAction({ code }), { step: -1 });
  for (const key of ['ArrowRight', 'd', 'D']) assert.deepEqual(menuKeyAction({ key }), { step: 1 });
  for (const code of ['Enter', 'NumpadEnter', 'Space']) assert.deepEqual(menuKeyAction({ code }), { start: true });
  assert.deepEqual(menuKeyAction({ code: 'ArrowUp' }, 2), { step: -2 });
  assert.deepEqual(menuKeyAction({ code: 'KeyS' }, 2), { step: 2 });
  assert.equal(menuKeyAction({ code: 'ArrowUp' }), null);
  assert.equal(menuKeyAction({ code: 'Escape' }), null);
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
    assert.equal(menuKeyAction({ code: 'KeyD', [modifier]: true }), null);
  }
});

test('runner indicators use actual health, range and complete volley damage', () => {
  assert.deepEqual(runnerStats('colossus').map(s => s.value), [6400, 2.7, 1560]);
  assert.equal(runnerStats('colossus')[0].max, 6400);
  assert.equal(runnerStats('spectre')[2].value, 1980);
  for (const id of RUNNER_IDS) {
    for (const stat of runnerStats(id)) assert.ok(stat.value > 0 && stat.value <= stat.max);
  }
});

// Exercise the actual HUD controller without constructing or DOM-testing the HUD.
const hudSource = await readFile(new URL('../public/runtime/Hud.js', import.meta.url), 'utf8');
function controller() {
  let settingsOpen = false;
  const context = {
    H: Vector3, menuKeyAction, nextRunnerId,
    window: { matchMedia: () => ({ matches: false }) },
    document: { getElementById: () => ({ classList: { contains: () => settingsOpen } }) },
  };
  runInNewContext(hudSource, context);
  const hud = Object.create(context.Yu.prototype);
  Object.assign(hud, {
    game: { state: 'menu' }, menuKeys: new Set(), selected: 'volt',
    menu: { classList: { contains: () => true } },
    chooseRunner(id) { this.selected = id; },
    confirmRunner() { this.starts = (this.starts || 0) + 1; this.game.state = 'countdown'; },
  });
  return { hud, settings: value => { settingsOpen = value; } };
}
function key(code, props = {}) {
  return { code, ...props, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
}

test('HUD owns menu navigation with body, roster or Start focus; start fires once', () => {
  const { hud } = controller();
  for (const tagName of ['BODY', 'BUTTON']) {
    const event = key('ArrowLeft', { target: { tagName } });
    hud.handleMenuKey(event);
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
    hud.menuKeys.clear();
  }
  assert.equal(hud.selected, 'hex');
  hud.handleMenuKey(key('Space'));
  assert.equal(hud.starts, 1);
  const repeat = key('Space', { repeat: true });
  hud.handleMenuKey(repeat);
  assert.equal(repeat.stopped, true);
  assert.equal(hud.starts, 1);
});

test('settings, gameplay and result screens retain their own controls', () => {
  const { hud, settings } = controller();
  settings(true);
  const sliderKey = key('ArrowRight');
  hud.handleMenuKey(sliderKey);
  assert.equal(sliderKey.prevented, undefined);
  assert.equal(hud.selected, 'volt');
  settings(false);
  for (const state of ['playing', 'ended', 'countdown']) {
    hud.game.state = state;
    const event = key('Enter');
    hud.handleMenuKey(event);
    assert.equal(event.prevented, undefined);
  }
  assert.equal(hud.starts, undefined);
});

test('showcase selection never substitutes a different live runner', () => {
  const other = { alive: true, def: RUNNERS.spectre };
  const selected = { alive: true, def: RUNNERS.volt };
  const director = new FrontEndDirector({ brawlers: [other, selected] });
  assert.equal(director.findSelectedRunner(), selected);
  selected.alive = false;
  assert.equal(director.findSelectedRunner(), null);
  const replacement = { alive: true, def: RUNNERS.volt };
  director.game.brawlers.push(replacement);
  assert.equal(director.findSelectedRunner(), replacement);
});

test('off-axis menu framing clears for match intro and retains runner identity', () => {
  const classes = { add() {}, remove() {} };
  const elements = new Map(['menu', 'match-intro', 'match-intro-name'].map(id => [id, { classList: classes, dataset: {} }]));
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = { body: { classList: classes, dataset: {} }, getElementById: id => elements.get(id) };
  globalThis.window = { innerWidth: 1440, innerHeight: 900 };
  try {
    const runner = { alive: true, x: 0, z: 0, aimAngle: 0, def: RUNNERS.volt };
    const camera = new PerspectiveCamera(32, 1440 / 900, 1, 260);
    const director = new FrontEndDirector({ brawlers: [runner], camera, world: { raycast: () => null } });
    director.menuT = 17;
    director.select('volt');
    assert.equal(director.menuT, 0);
    const focus = new Vector3();
    for (let i = 0; i < 120; i++) director.updateMenuCamera(1 / 60, camera, focus, 1);
    camera.updateMatrixWorld();
    const projected = new Vector3(0, .85, 0).project(camera);
    assert.ok(projected.x > .25 && projected.x < .4, 'hero should sit centre-right');
    assert.ok(projected.y > .1 && projected.y < .25, 'hero should sit above the controls');
    director.startMatch('volt');
    assert.equal(camera.view.enabled, false);
    assert.equal(director.mode, 'intro');
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});
