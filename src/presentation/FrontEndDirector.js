const clamp01 = (value) => Math.max(0, Math.min(1, value));
const damp = (current, target, speed, dt) => current + (target - current) * (1 - Math.exp(-speed * dt));
const mix = (a, b, t) => a + (b - a) * t;

export const MENU_SHOTS = Object.freeze([
  Object.freeze({ id: 'hero', duration: 5.8 }),
  Object.freeze({ id: 'duel', duration: 4.4 }),
  Object.freeze({ id: 'wide', duration: 4.8 }),
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
    this.menuAngle = 0.72;
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
    this.cachedRunner = null;
    this.selectionPulse = immediate ? 0 : 1;
    const menu = get('menu');
    if (menu) menu.dataset.runner = id;
    document.body.dataset.runner = id;
  }

  startMatch(id) {
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
        runner.readabilityHalo.material.opacity = Math.max(
          runner.readabilityHalo.material.opacity,
          0.16 + this.selectionPulse * 0.28 + Math.sin(this.menuT * 2.1) * 0.025
        );
        runner.superRing.material.opacity = Math.max(
          runner.superRing.material.opacity,
          0.035 + this.selectionPulse * 0.18
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
    this.cachedRunner = candidates[0] || this.game.brawlers.find((runner) => runner.alive) || null;
    return this.cachedRunner;
  }

  nearestRival(runner) {
    if (!runner) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const other of this.game.brawlers) {
      if (other === runner || !other.alive) continue;
      const dx = other.x - runner.x;
      const dz = other.z - runner.z;
      const distance = dx * dx + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = other;
      }
    }
    return best;
  }

  updateMenuCamera(dt, camera, focus, aspectScale) {
    const runner = this.findSelectedRunner();
    if (!runner) return false;

    const rival = this.nearestRival(runner);
    const shot = frontEndShotAt(this.menuT);
    this.menuAngle += dt * (shot.id === 'hero' ? 0.075 : 0.045);

    let focusX = runner.x;
    let focusZ = runner.z;
    let height = 8.4;
    let distance = 10.5;
    let focusY = 0.72;
    let angle = this.menuAngle;

    if (shot.id === 'duel' && rival) {
      focusX = (runner.x + rival.x) * 0.5;
      focusZ = (runner.z + rival.z) * 0.5;
      const dx = rival.x - runner.x;
      const dz = rival.z - runner.z;
      angle = Math.atan2(dx, dz) + 0.82;
      distance = 15.5;
      height = 11.7;
      focusY = 0.46;
    } else if (shot.id === 'wide') {
      distance = 22.5;
      height = 18.2;
      focusY = 0.18;
    }

    const scale = mix(1, aspectScale, 0.65);
    distance *= scale;
    height *= scale;

    const x = focusX + Math.sin(angle) * distance * 0.72;
    const z = focusZ + Math.cos(angle) * distance;
    const blend = 1 - Math.exp(-dt * 2.2);

    focus.x = damp(focus.x, focusX, 2.8, dt);
    focus.z = damp(focus.z, focusZ, 2.8, dt);
    camera.position.x += (x - camera.position.x) * blend;
    camera.position.y += (height - camera.position.y) * blend;
    camera.position.z += (z - camera.position.z) * blend;

    const desiredFov = shot.id === 'hero' ? 29.5 : shot.id === 'duel' ? 31 : 32.5;
    if (Math.abs(camera.fov - desiredFov) > 0.001) {
      camera.fov = damp(camera.fov, desiredFov, 2.6, dt);
      camera.updateProjectionMatrix();
    }

    camera.lookAt(focus.x, focusY, focus.z);
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
