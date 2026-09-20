const clamp01 = (value) => Math.max(0, Math.min(1, value));
const damp = (current, target, speed, dt) => current + (target - current) * (1 - Math.exp(-speed * dt));
const mix = (a, b, t) => a + (b - a) * t;

export const MENU_SHOTS = Object.freeze([
  Object.freeze({ id: 'hero', duration: 12 }),
  Object.freeze({ id: 'profile', duration: 4 }),
  Object.freeze({ id: 'wide', duration: 2 }),
]);

export function frontEndShotAt(seconds) {
  const total = MENU_SHOTS.reduce((sum, shot) => sum + shot.duration, 0);
  let cursor = ((seconds % total) + total) % total;
  for (const shot of MENU_SHOTS) {
    if (cursor < shot.duration) {
      return {
        id: shot.id,
        progress: clamp01(cursor / shot.duration),
      };
    }
    cursor -= shot.duration;
  }
  return { id: MENU_SHOTS[0].id, progress: 0 };
}

export function resultTreatment(won) {
  return won
    ? { title: 'GRID SECURED', kicker: 'ARENA CLEARED', tone: 'win' }
    : { title: 'SIGNAL LOST', kicker: 'RUN TERMINATED', tone: 'lose' };
}

const get = (id) => document.getElementById(id);

export class FrontEndDirector {
  constructor(game) {
    this.game = game;
    this.mode = 'menu';
    this.selected = 'volt';
    this.menuT = 0;
    this.selectionPulse = 0;
    this.introT = 0;
    this.endT = 0;
    this.endState = null;
    this.menuAngle = null;
    this.angleCheckT = 0;
    this.snapMenuCamera = true;
    this.cachedRunner = null;
  }

  enterMenu(selected = this.selected) {
    this.mode = 'menu';
    this.menuT = 0;
    this.endT = 0;
    this.endState = null;
    this.selected = selected;
    this.cachedRunner = null;
    this.clearBodyResultState();
    document.body.classList.remove('match-intro-active', 'end-cinematic', 'end-win', 'end-lose');
    const intro = get('match-intro');
    if (intro) intro.classList.remove('open');
    this.select(selected, true);
  }

  select(id, immediate = false) {
    this.selected = id;
    this.menuT = 0;
    this.menuAngle = null;
    this.angleCheckT = 0;
    this.snapMenuCamera = true;
    this.cachedRunner = null;
    this.selectionPulse = immediate ? 0 : 1;
    const menu = get('menu');
    if (menu) menu.dataset.runner = id;
    document.body.dataset.runner = id;
  }

  startMatch(id) {
    this.game.camera.clearViewOffset();
    this.mode = 'intro';
    this.selected = id;
    this.introT = 1.45;
    this.selectionPulse = 0;
    this.clearBodyResultState();
    document.body.classList.add('match-intro-active');
    const intro = get('match-intro');
    const name = get('match-intro-name');
    const def = globalThis.Bc && globalThis.Bc[id];
    if (name) name.textContent = def ? def.name : id.toUpperCase();
    if (intro) intro.classList.add('open');
  }

  beginEnd(won, subject, killer) {
    this.game.camera.clearViewOffset();
    this.mode = 'end';
    this.endT = 0;
    this.endState = {
      won,
      x: subject ? subject.x : 0,
      z: subject ? subject.z : 0,
      subject,
      killer,
    };
    document.body.classList.add('end-cinematic', won ? 'end-win' : 'end-lose');
    document.body.classList.remove(won ? 'end-lose' : 'end-win');
  }

  showResult(won) {
    const treatment = resultTreatment(won);
    document.body.classList.add('result-visible', 'result-' + treatment.tone);
    document.body.classList.remove(won ? 'result-lose' : 'result-win');
  }

  hideResult() {
    this.clearBodyResultState();
  }

  clearBodyResultState() {
    document.body.classList.remove('result-visible', 'result-win', 'result-lose');
  }

  update(dt) {
    if (this.mode === 'menu') {
      this.menuT += dt;
      this.selectionPulse = Math.max(0, this.selectionPulse - dt * 2.8);
      const runner = this.findSelectedRunner();
      if (runner && runner.alive) {
        // Reuse the gameplay foliage reveal purely for the menu's selected subject.
        this.game.world.grassUniforms.uReveal.value.set(runner.x, runner.z, 0, 1);
        this.game.lighting.addLight(runner.x, 2.5, runner.z, runner.lightColor, 2.2, 6);
        runner.superRing.material.opacity = Math.max(
          runner.superRing.material.opacity, 0.08 + this.selectionPulse * 0.3
        );
      }
      return;
    }

    if (this.mode === 'intro') {
      this.introT = Math.max(0, this.introT - dt);
      if (this.introT <= 0) {
        this.mode = 'play';
        document.body.classList.remove('match-intro-active');
        const intro = get('match-intro');
        if (intro) intro.classList.remove('open');
      }
      return;
    }

    if (this.mode === 'end' || this.mode === 'result') {
      this.endT += dt;
    }
  }

  findSelectedRunner() {
    if (this.cachedRunner && this.cachedRunner.alive && this.cachedRunner.def.id === this.selected) {
      return this.cachedRunner;
    }

    const candidates = this.game.brawlers.filter((runner) => runner.alive && runner.def.id === this.selected);
    this.cachedRunner = candidates.find((runner) => !runner.inBush) || candidates[0] || null;
    return this.cachedRunner;
  }

  updateMenuCamera(dt, camera, focus, aspectScale) {
    const runner = this.findSelectedRunner();
    if (!runner) return false;

    const shot = frontEndShotAt(this.menuT);
    document.body.dataset.menuShot = shot.id;
    const wide = shot.id === 'wide';
    const profile = shot.id === 'profile';
    const distance = (wide ? 13 : profile ? 7.6 : 6.2) * mix(1, aspectScale, 0.22);
    let height = wide ? 11 : profile ? 5.7 : 4.8;
    const desiredFov = wide ? 34 : 29;

    // Hold a stable front/three-quarter angle instead of chasing every AI aim turn.
    // Check only the near sightline: distant walls are below this elevated camera.
    this.angleCheckT -= dt;
    if (this.menuAngle === null || this.angleCheckT <= 0) {
      const preferred = this.menuAngle ?? runner.aimAngle + 0.4;
      let bestAngle = preferred;
      let bestScore = -Infinity;
      for (const offset of [0, 0.65, -0.65, 1.3, -1.3, Math.PI]) {
        const angle = preferred + offset;
        const dx = Math.sin(angle), dz = Math.cos(angle);
        const hit = this.game.world.raycast(runner.x, runner.z, runner.x + dx * 3.4, runner.z + dz * 3.4);
        const clear = hit ? hit.dist : 3.4;
        const score = clear - Math.abs(offset) * 0.35;
        if (score > bestScore) { bestAngle = angle; bestScore = score; }
      }
      this.menuAngle = bestAngle;
      this.angleCheckT = 0.8;
    }
    const angle = this.menuAngle + (profile ? 0.22 : 0);
    const closeCover = this.game.world.raycast(runner.x, runner.z,
      runner.x + Math.sin(angle) * 2.2, runner.z + Math.cos(angle) * 2.2);
    if (closeCover) height += 2.3;

    // A selection is an arcade camera cut, not a long fly-through across the arena.
    if (this.snapMenuCamera) {
      focus.x = runner.x;
      focus.z = runner.z;
      camera.position.set(runner.x + Math.sin(angle) * distance, height, runner.z + Math.cos(angle) * distance);
      camera.fov = desiredFov;
      this.snapMenuCamera = false;
    }
    focus.x = damp(focus.x, runner.x, 7, dt);
    focus.z = damp(focus.z, runner.z, 7, dt);
    camera.position.x = damp(camera.position.x, runner.x + Math.sin(angle) * distance, 5, dt);
    camera.position.y = damp(camera.position.y, height, 4, dt);
    camera.position.z = damp(camera.position.z, runner.z + Math.cos(angle) * distance, 5, dt);
    camera.fov = damp(camera.fov, desiredFov, 3, dt);

    // Off-axis composition leaves the left for identity and the bottom for controls.
    const width = window.innerWidth, viewportHeight = window.innerHeight;
    const portrait = width <= 600 && viewportHeight > width;
    const tablet = width <= 1050 && viewportHeight > 600 && !portrait;
    camera.setViewOffset(width, viewportHeight, -width * (wide ? 0.08 : 0.16),
      viewportHeight * (portrait ? 0.24 : tablet ? 0.19 : 0.09), width, viewportHeight);
    camera.lookAt(focus.x, 0.85, focus.z);
    return true;
  }

  updateEndCamera(dt, camera, focus, aspectScale) {
    if (!this.endState) return false;

    const state = this.endState;
    const subject = state.subject && state.subject.alive ? state.subject : null;
    const killer = state.killer && state.killer.alive ? state.killer : null;
    const t = clamp01(this.endT / 2.2);

    let focusX = state.x;
    let focusZ = state.z;
    let focusY = state.won ? 0.82 : 0.2;
    let distance;
    let height;
    let angle;

    if (state.won && subject) {
      focusX = subject.x;
      focusZ = subject.z;
      distance = mix(10.5, 12.2, t) * mix(1, aspectScale, 0.55);
      height = mix(7.2, 8.6, t) * mix(1, aspectScale, 0.4);
      angle = subject.aimAngle + Math.PI + 0.45 + this.endT * 0.06;
    } else {
      if (killer) {
        focusX = mix(state.x, killer.x, 0.28);
        focusZ = mix(state.z, killer.z, 0.28);
      }
      distance = mix(10.5, 18.5, t) * mix(1, aspectScale, 0.62);
      height = mix(8.2, 15.5, t) * mix(1, aspectScale, 0.5);
      angle = 0.9 + this.endT * 0.025;
    }

    const x = focusX + Math.sin(angle) * distance * 0.72;
    const z = focusZ + Math.cos(angle) * distance;
    const blend = 1 - Math.exp(-dt * (state.won ? 2.7 : 1.8));

    focus.x = damp(focus.x, focusX, 3, dt);
    focus.z = damp(focus.z, focusZ, 3, dt);
    camera.position.x += (x - camera.position.x) * blend;
    camera.position.y += (height - camera.position.y) * blend;
    camera.position.z += (z - camera.position.z) * blend;

    const desiredFov = state.won ? 28.5 : 34;
    if (Math.abs(camera.fov - desiredFov) > 0.001) {
      camera.fov = damp(camera.fov, desiredFov, 2.4, dt);
      camera.updateProjectionMatrix();
    }

    camera.lookAt(focus.x, focusY, focus.z);
    return true;
  }
}
