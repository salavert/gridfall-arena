import test from 'node:test';
import assert from 'node:assert/strict';

import { MENU_SHOTS, frontEndShotAt, resultTreatment } from '../src/presentation/FrontEndDirector.js';

test('front-end camera shots cycle deterministically', () => {
  assert.equal(frontEndShotAt(0).id, 'hero');
  assert.equal(frontEndShotAt(MENU_SHOTS[0].duration + 0.01).id, 'profile');
  assert.equal(frontEndShotAt(MENU_SHOTS[0].duration + MENU_SHOTS[1].duration + 0.01).id, 'wide');

  const total = MENU_SHOTS.reduce((sum, shot) => sum + shot.duration, 0);
  assert.equal(frontEndShotAt(total + 0.25).id, frontEndShotAt(0.25).id);
  assert.ok(frontEndShotAt(1).progress > 0);
  assert.ok(frontEndShotAt(1).progress < 1);
});

test('result treatment keeps victory and defeat visually distinct', () => {
  assert.deepEqual(resultTreatment(true), {
    title: 'GRID SECURED',
    kicker: 'ARENA CLEARED',
    tone: 'win',
  });
  assert.deepEqual(resultTreatment(false), {
    title: 'SIGNAL LOST',
    kicker: 'RUN TERMINATED',
    tone: 'lose',
  });
});

test('hero owns most of the attract cycle and shot boundaries are exact', () => {
  const [hero, profile, wide] = MENU_SHOTS;
  assert.ok(hero.duration > profile.duration + wide.duration);
  assert.ok(wide.duration < profile.duration);
  assert.deepEqual(frontEndShotAt(hero.duration), { id: 'profile', progress: 0 });
  assert.deepEqual(frontEndShotAt(hero.duration + profile.duration), { id: 'wide', progress: 0 });
  assert.deepEqual(frontEndShotAt(hero.duration + profile.duration + wide.duration), { id: 'hero', progress: 0 });
  assert.equal(frontEndShotAt(-0.1).id, 'wide');
});
