import test from 'node:test';
import assert from 'node:assert/strict';

import { MENU_SHOTS, frontEndShotAt, resultTreatment } from '../src/presentation/FrontEndDirector.js';

test('front-end camera shots cycle deterministically', () => {
  assert.equal(frontEndShotAt(0).id, 'hero');
  assert.equal(frontEndShotAt(MENU_SHOTS[0].duration + 0.01).id, 'duel');
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
