import { ChargeTrigger, voltShot, VOLT_CHARGE_TIME } from './weapon.js';
import { FixedClock } from './timing.js';

export function shootVolt(runner, aim, seconds = 0) {
  if (!runner.canAct() || runner.ammo < 1 || runner.fireCooldown > 0 || runner.burst) return false;
  const shot = voltShot(runner.def.attack, seconds);
  runner.ammo--;
  runner.startVolley(shot, aim.dx, aim.dz, aim.x, aim.z, false);
  runner.fireCooldown = 0.28 + shot.charge * 0.12;
  runner.voltCharge = 0;
  runner.knock.set(-aim.dx * (0.6 + shot.charge), -aim.dz * (0.6 + shot.charge));
  return true;
}

export function attackVolt(runner, dx, dz, x, z) {
  if (!runner.canAct() || runner.ammo < 1 || runner.fireCooldown > 0 || runner.voltPlan) return false;
  const aim = { dx, dz, x, z };
  if (!runner.isPlayer && Math.hypot(x - runner.x, z - runner.z) > 4.2) {
    runner.voltPlan = { aim, duration: 0.62 + (runner.id % 3) * 0.11, elapsed: 0 };
    return true;
  }
  return shootVolt(runner, aim);
}

export function updateVoltCharge(runner, dt) {
  if (!runner.voltPlan) return;
  const plan = runner.voltPlan;
  if (!runner.alive || !runner.canAct()) { runner.voltPlan = null; runner.voltCharge = 0; return; }
  plan.elapsed += dt;
  runner.voltCharge = plan.elapsed;
  runner.aimAngle = Math.atan2(plan.aim.dx, plan.aim.dz);
  runner.aimHold = 0.2;
  runner.revealT = Math.max(runner.revealT, 0.25);
  runner.lastCombat = runner.game.elapsed;
  if (plan.elapsed >= plan.duration) {
    runner.voltPlan = null;
    shootVolt(runner, plan.aim, plan.elapsed);
  }
}

function triggerFor(game) {
  const player = game.player;
  player.voltTrigger ??= new ChargeTrigger();
  if (player.voltCancel !== game.input.cancelSerial) {
    player.voltTrigger.cancel(!!game.input.fire || game.input.sticks?.aim?.id != null);
    player.voltCancel = game.input.cancelSerial;
    player.voltCharge = 0;
  }
  return player.voltTrigger;
}

function updateChargeVisual(game, held) {
  const player = game.player;
  player.voltCharge = held;
  if (held > 0) {
    player.aimHold = 0.15;
    player.revealT = Math.max(player.revealT, 0.2);
    player.lastCombat = game.elapsed;
  }
  const meter = document.getElementById('volt-charge');
  if (!meter) return;
  const ratio = Math.min(1, held / VOLT_CHARGE_TIME);
  meter.hidden = game.state !== 'playing';
  meter.style.setProperty('--charge', `${Math.round(ratio * 100)}%`);
  meter.classList.toggle('charged', ratio >= 0.99);
  const label = ratio >= 0.99 ? 'FULL CHARGE · RELEASE' : held > 0 ? 'FOCUSING…' : 'TAP: SCATTER · HOLD: FOCUS';
  if (meter.dataset.label !== label) {
    meter.dataset.label = label;
    meter.querySelector('span').textContent = label;
  }
  if (ratio >= 0.99 && !player.voltReadySound) {
    player.voltReadySound = true;
    const audio = game.audio;
    if (audio.ctx && !audio.muted) {
      audio.tone('sine', 980, 1380, 0.1, 0.13);
      audio.tone('triangle', 1380, 1380, 0.12, 0.08, 0.065);
    }
  }
  if (held === 0) player.voltReadySound = false;
}

function drawGuide(game, aim, seconds, overdrive = false) {
  const p = game.player;
  const shot = overdrive ? p.def.super : voltShot(p.def.attack, seconds);
  game.updateGuide(shot, overdrive ? 'super' : 'attack', aim.dx, aim.dz, aim.dist || shot.range, overdrive);
  if (!overdrive) {
    // Reuse the cached sector mesh rather than allocating geometry while aiming.
    game.guideSector.scale.set(shot.range, 1, shot.range * shot.spread / p.def.attack.spread);
    game.guideSector.material.color.set(seconds >= VOLT_CHARGE_TIME ? 0xffcc69 : 0x90fff0);
    game.guideSector.material.opacity = 0.16 + Math.min(1, seconds / VOLT_CHARGE_TIME) * 0.12;
  }
}

export function controlVoltDesktop(game, dt, aim) {
  const p = game.player, input = game.input, trigger = triggerFor(game);
  const overdrive = input.consumeSuperRelease();
  const superHeld = input.superHeld && p.superReady;
  const release = input.fireReleased || (!input.fire && trigger.active);
  const shot = trigger.step({ down: input.fire, pressed: input.firePressed,
    released: release, dt, allowed: game.state === 'playing' && p.canAct() && p.ammo >= 1 && p.fireCooldown <= 0 && !superHeld && !overdrive });
  input.firePressed = input.fireReleased = false;
  if (overdrive && p.superReady) p.useSuper(aim.dx, aim.dz, aim.x, aim.z);
  else if (shot !== null) shootVolt(p, aim, shot);
  p.aimAngle = Math.atan2(aim.dx, aim.dz);
  updateChargeVisual(game, trigger.held);
  drawGuide(game, aim, trigger.held, superHeld);
}

export function controlVoltTouch(game, dt) {
  const p = game.player, input = game.input, trigger = triggerFor(game);
  const axis = input.axis(); p.moveX = axis.x; p.moveZ = axis.z;
  const stick = input.sticks.aim;
  const superStick = input.sticks.super;
  const overdriveHeld = superStick.id !== null;
  const aim = stick.id !== null && stick.moved ? game.stickAim(stick, p.def.attack) : game.autoAim(p.def.attack);
  const shots = input.takeShots();
  const attack = shots.find(s => s.kind === 'attack');
  const special = shots.find(s => s.kind === 'super' && !s.cancelled);
  if (attack?.cancelled || (!attack && stick.id === null && trigger.active)) trigger.cancel();
  const seconds = trigger.step({ down: stick.id !== null, pressed: !!attack && !attack.cancelled,
    released: !!attack && !attack.cancelled, dt,
    allowed: game.state === 'playing' && p.canAct() && p.ammo >= 1 && p.fireCooldown <= 0 && !overdriveHeld && !special });
  if (special) {
    const a = special.tap ? game.autoAim(p.def.super) : game.stickAim(special, p.def.super);
    p.useSuper(a.dx, a.dz, a.x, a.z);
  } else if (seconds !== null) {
    const a = attack.tap ? game.autoAim(p.def.attack) : game.stickAim(attack, p.def.attack);
    shootVolt(p, a, seconds);
  }
  updateChargeVisual(game, trigger.held);
  if (overdriveHeld && superStick.moved && p.superReady) drawGuide(game, game.stickAim(superStick, p.def.super), 0, true);
  else if (stick.id !== null) {
    p.aimAngle = Math.atan2(aim.dx, aim.dz);
    drawGuide(game, aim, trigger.held);
  } else game.guide.visible = false;
}

export function voltShotFeedback(runner, special, charge = 0) {
  const g = runner.game, a = g.audio;
  if (a.ctx && !a.muted) {
    const volume = a.loudness(runner.x, runner.z);
    a.noise('lowpass', special ? 4200 : 2600, 160, 0.14 + charge * 0.1, volume * 0.7);
    a.tone('sine', 190 + charge * 70, 45, 0.17, volume * 0.45);
    a.tone('triangle', 1100 + charge * 900, 250, 0.1, volume * 0.13);
  }
  const x = runner.x + Math.sin(runner.aimAngle) * 0.9;
  const z = runner.z + Math.cos(runner.aimAngle) * 0.9;
  const color = special ? runner.superColor : runner.lightColor;
  const dx = Math.sin(runner.aimAngle), dz = Math.cos(runner.aimAngle);
  const power = special ? 1 : charge;
  g.effects.flash(x + dx * 0.18, 0.78, z + dz * 0.18, color, 5 + power * 8, 4 + power * 3, 0.09 + power * 0.04);
  // The engine already emits the base muzzle plume. Volt adds a tight electric
  // snap so charge is readable from the projectile origin, not just the HUD.
  const sparkCount = special ? 7 : charge > 0.65 ? 5 : charge > 0.25 ? 2 : 0;
  for (let i = 0; i < sparkCount; i++) g.effects.spark?.(x + dx * 0.1, 0.76, z + dz * 0.1, color);
  if (charge > 0.45 || special) {
    g.effects.ring?.(runner.x, runner.z, 0.18 + power * 0.22, color, 0.16 + power * 0.08, 2.2 + power * 1.8);
    g.effects.burst(x, 0.72, z, color, special ? 20 : 7 + Math.round(charge * 8), 2.6 + power * 1.5);
  }
  // Even a tap has a tiny impulse; focused shots should feel substantially
  // heavier without making sustained fire uncomfortable.
  g.shake(special ? 0.24 : 0.025 + charge * 0.085, runner.x, runner.z);
}

// A visible charge is a dodge opportunity, not instantaneous omniscience.
export function reactToVolt(brain, dt) {
  const b = brain.b, g = brain.game;
  if (!b.alive || g.state !== 'playing' || b.airborne) return;
  const threat = g.brawlers.find(p => p !== b && p.alive && !p.hidden && p.voltCharge > 0.3 &&
    Math.hypot(p.x - b.x, p.z - b.z) < 8 && g.world.hasLineOfSight(b.x, b.z, p.x, p.z));
  if (!threat) { brain.voltThreat = null; brain.voltReaction = 0; return; }
  if (brain.voltThreat !== threat.id) { brain.voltThreat = threat.id; brain.voltReaction = 0; }
  brain.voltReaction += dt;
  if (brain.voltReaction < 0.16 + (1 - brain.skill) * 0.3 || brain.state === 'escape') return;
  const dx = b.x - threat.x, dz = b.z - threat.z, distance = Math.hypot(dx, dz) || 1;
  const alignment = (dx * Math.sin(threat.aimAngle) + dz * Math.cos(threat.aimAngle)) / distance;
  if (alignment < 0.94) return;
  let x = -dz / distance * brain.strafeDir, z = dx / distance * brain.strafeDir;
  const safe = (x, z) => g.world.isWalkable(g.world.toTile(b.x + x * 0.9), g.world.toTile(b.z + z * 0.9)) &&
    (!g.gas.active || g.gas.depthAt(b.x + x, b.z + z) < -0.5);
  if (!safe(x, z)) { x = -x; z = -z; }
  if (safe(x, z)) { b.moveX = x; b.moveZ = z; }
}

export function runFrame(game, now) {
  const raw = (now - game.last) / 1000;
  game.last = now;
  const info = game.pipeline.renderer.info;
  game.frameStats.calls = info.render.calls;
  game.frameStats.triangles = info.render.triangles;
  info.reset();
  game.fixedClock ??= new FixedClock();
  if (document.hidden) {
    game.fixedClock.pending = 0;
    game.input.cancelSerial = (game.input.cancelSerial || 0) + 1;
  } else {
    if (game.paused) {
      game.player?.voltTrigger?.cancel(!!game.input.fire || game.input.sticks?.aim?.id != null);
      if (game.player) game.player.voltCharge = 0;
      const meter = document.getElementById('volt-charge');
      if (meter) meter.hidden = true;
    }
    const freeze = Math.min(Math.max(game.hitStop || 0, 0), Math.max(raw, 0));
    if (freeze > 0) game.hitStop = Math.max(0, game.hitStop - freeze);
    const simRaw = Math.max(0, raw - freeze);
    game.fixedClock.advance(simRaw, dt => {
      for (let i = 0; i < game.simSteps; i++) {
        if (game.hitStop > 0) return;
        game.update(dt);
      }
    });
    game.pipeline.render(Math.min(raw, 0.2));
    if (game.warmup > 0 && --game.warmup === 0) {
      game.benchmarkQuality(); game.last = performance.now();
      document.getElementById('loading').classList.add('done');
    }
    game.adaptQuality(raw);
  }
  requestAnimationFrame(game.frame);
}
