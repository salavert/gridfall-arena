import * as THREE from 'three';
import { GAME, PALETTE, RUNNERS } from '../config.js';
import { clamp, distanceSq, normalize2 } from './math.js';
import { Input } from './Input.js';
import { Hud } from './Hud.js';
import { GameRenderer } from '../rendering/Renderer.js';
import { stylizedMaterial } from '../rendering/Visuals.js';
import { AudioSystem } from '../systems/Audio.js';
import { VfxSystem } from '../systems/Vfx.js';
import { Arena } from '../world/Arena.js';
import { Runner } from '../entities/Runner.js';

const BOT_NAMES = ['KILO-9', 'MIRAGE', 'SABLE', 'ION', 'HEX', 'MOTH', 'BRICK', 'ECHO'];
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimPoint = new THREE.Vector3();

export class Game {
  constructor(canvas) {
    this.config = GAME;
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.ink);
    this.scene.fog = new THREE.FogExp2(PALETTE.ink, 0.016);
    this.camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 150);
    this.camera.position.set(18, 26, 24);
    this.renderer = new GameRenderer(canvas, this.scene, this.camera);
    this.input = new Input(canvas);
    this.audio = new AudioSystem();
    this.vfx = new VfxSystem(this.scene);
    this.hud = new Hud(this);
    this.state = 'menu';
    this.time = 0;
    this.matchTime = 0;
    this.lastTime = performance.now();
    this.runners = [];
    this.projectiles = [];
    this.shards = [];
    this.projectileGeometry = new THREE.CapsuleGeometry(0.1, 0.52, 3, 7);
    this.projectileGeometry.rotateX(Math.PI / 2);
    this.player = null;
    this.cameraFocus = new THREE.Vector3();
    this.cameraShake = 0;
    this.seed = Math.floor(Math.random() * 1_000_000_000);
    this.setupLighting();
    this.arena = new Arena(this.scene, this.vfx, this.seed);
    this.spawnMenuRunner();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    setTimeout(() => document.getElementById('loading').classList.add('is-done'), 450);
  }

  setupLighting() {
    const hemisphere = new THREE.HemisphereLight(0x779dff, 0x160d31, 1.35);
    this.scene.add(hemisphere);
    this.sun = new THREE.DirectionalLight(0xffd4b8, 3.1);
    this.sun.position.set(-15, 28, 18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -24;
    this.sun.shadow.camera.right = 24;
    this.sun.shadow.camera.top = 24;
    this.sun.shadow.camera.bottom = -24;
    this.sun.shadow.camera.near = 5;
    this.sun.shadow.camera.far = 70;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);
    const cyan = new THREE.PointLight(PALETTE.cyan, 16, 24, 2);
    cyan.position.set(-13, 5, -10);
    this.scene.add(cyan);
    const magenta = new THREE.PointLight(PALETTE.magenta, 12, 22, 2);
    magenta.position.set(12, 4, 9);
    this.scene.add(magenta);
  }

  spawnMenuRunner() {
    this.clearRunners();
    const runner = new Runner(this, RUNNERS.flux, { x: 0, z: 1, isPlayer: false, name: 'FLUX' });
    runner.ai.target = null;
    this.runners.push(runner);
  }

  start(runnerId) {
    this.audio.unlock();
    this.clearWorld();
    this.seed = Math.floor(Math.random() * 1_000_000_000);
    this.arena = new Arena(this.scene, this.vfx, this.seed);
    const points = this.arena.spawnPoints();
    const choices = Object.values(RUNNERS);
    this.player = new Runner(this, RUNNERS[runnerId] || RUNNERS.flux, { x: points[0][0], z: points[0][1], isPlayer: true, name: 'YOU' });
    this.runners.push(this.player);
    for (let index = 0; index < GAME.bots; index += 1) {
      const point = points[index + 1];
      const definition = choices[(index + 1) % choices.length];
      this.runners.push(new Runner(this, definition, { x: point[0], z: point[1], name: BOT_NAMES[index] }));
    }
    this.matchTime = 0;
    this.state = 'countdown';
    this.countdown = 3.25;
    this.lastCount = 4;
    this.input.enabled = true;
    this.hud.showGame();
    this.hud.banner('SYNCING RUNNERS', 0.8, 'var(--cyan)');
    this.renderer.markShadowsDirty();
  }

  toMenu() {
    this.input.enabled = false;
    this.state = 'menu';
    this.clearWorld();
    this.arena = new Arena(this.scene, this.vfx, Math.floor(Math.random() * 1_000_000));
    this.spawnMenuRunner();
  }

  clearWorld() {
    this.clearRunners();
    if (this.arena) this.arena.dispose();
    for (const projectile of this.projectiles) {
      this.scene.remove(projectile.mesh);
    }
    for (const shard of this.shards) {
      this.scene.remove(shard.mesh);
      shard.mesh.geometry.dispose();
      shard.mesh.material.dispose();
    }
    this.projectiles.length = 0;
    this.shards.length = 0;
    this.player = null;
  }

  clearRunners() {
    this.runners.forEach((runner) => runner.dispose());
    this.runners.length = 0;
  }

  spawnProjectile(owner, dx, dz) {
    const material = stylizedMaterial({ color: owner.definition.accent, emissive: owner.definition.accent, emissiveIntensity: 3.2, roughness: 0.2 });
    const mesh = new THREE.Mesh(this.projectileGeometry, material);
    mesh.position.set(owner.x + dx * 0.85, 1.05, owner.z + dz * 0.85);
    mesh.rotation.y = Math.atan2(dx, dz);
    this.scene.add(mesh);
    this.projectiles.push({
      owner,
      mesh,
      velocity: new THREE.Vector3(dx * owner.definition.projectileSpeed, 0, dz * owner.definition.projectileSpeed),
      damage: owner.definition.damage * (owner.overdrive > 0 ? 1.26 : 1),
      life: 1.2,
      color: owner.definition.accent,
    });
  }

  spawnShard(x, z, color) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      stylizedMaterial({ color, emissive: color, emissiveIntensity: 2.4, metalness: 0.2, roughness: 0.25 }),
    );
    mesh.position.set(x, 0.65, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.shards.push({ mesh, x, z, age: 0 });
  }

  updateProjectiles(dt) {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.life -= dt;
      projectile.mesh.position.addScaledVector(projectile.velocity, dt);
      const { x, y, z } = projectile.mesh.position;
      this.vfx.trail(x, y, z, projectile.color);
      let hit = projectile.life <= 0 || this.arena.collides(x, z, 0.08);
      if (!hit) {
        const relayHit = this.arena.damageRelay(x, z, 0.26, projectile.damage * (projectile.owner.definition.id === 'nova' ? 1.55 : 1));
        if (relayHit) {
          hit = true;
          projectile.owner.core = clamp(projectile.owner.core + 0.12, 0, 1);
          if (relayHit.triggered) {
            this.hud.feed(`${projectile.owner.name} overloaded relay ${relayHit.relay.id + 1}`);
            this.hud.banner('SECTOR SEVERING', 1.25, 'var(--danger)');
            this.audio.play('relay', this.panFor(relayHit.relay.x));
          }
        } else {
          for (const runner of this.runners) {
            if (!runner.alive || runner === projectile.owner) continue;
            if (distanceSq(x, z, runner.x, runner.z) < 0.52 ** 2) {
              hit = runner.damage(projectile.damage, projectile.owner);
              if (hit) projectile.owner.core = clamp(projectile.owner.core + 0.07, 0, 1);
              break;
            }
          }
        }
      }
      if (hit) {
        this.vfx.emit(x, y, z, projectile.color, 7, { speed: 2.8, lift: 1.2, life: 0.25, size: 12, gravity: 2 });
        this.vfx.ring(x, z, projectile.color, 0.16, 0.2);
        this.scene.remove(projectile.mesh);
        this.projectiles.splice(index, 1);
      }
    }
  }

  updateShards(dt) {
    for (let index = this.shards.length - 1; index >= 0; index -= 1) {
      const shard = this.shards[index];
      shard.age += dt;
      shard.mesh.rotation.y += dt * 2.8;
      shard.mesh.position.y = 0.62 + Math.sin(shard.age * 4) * 0.14;
      for (const runner of this.runners) {
        if (!runner.alive || distanceSq(shard.x, shard.z, runner.x, runner.z) > 1.05 ** 2) continue;
        runner.shards += 1;
        runner.core = clamp(runner.core + 0.18, 0, 1);
        this.vfx.emit(shard.x, 0.8, shard.z, runner.definition.color, 14, { speed: 3, lift: 3, life: 0.4, size: 16, gravity: 3 });
        this.audio.play('pickup', this.panFor(shard.x));
        if (runner.isPlayer && runner.shards % 3 === 0) this.hud.banner(`PULSE MK ${['I', 'II', 'III'][runner.weaponLevel - 1]} ONLINE`, 1.3, 'var(--lime)');
        this.scene.remove(shard.mesh);
        shard.mesh.geometry.dispose();
        shard.mesh.material.dispose();
        this.shards.splice(index, 1);
        break;
      }
    }
  }

  updatePlayer(dt) {
    if (!this.player?.alive) return;
    const movement = this.input.movement();
    raycaster.setFromCamera(this.input.pointer, this.camera);
    if (raycaster.ray.intersectPlane(groundPlane, aimPoint)) this.player.setAim(aimPoint.x - this.player.x, aimPoint.z - this.player.z);
    this.player.move(movement, dt);
    if (this.input.firing) this.player.fire();
    if (this.input.consumeDash()) this.player.dash(movement);
    if (this.input.consumeOverdrive() && this.player.activateOverdrive()) this.hud.banner('OVERDRIVE', 0.8, 'var(--magenta)');
  }

  updateBots(dt) {
    const alive = this.runners.filter((runner) => runner.alive);
    for (const bot of alive) {
      if (bot.isPlayer) continue;
      bot.ai.think -= dt;
      if (bot.ai.think <= 0 || !bot.ai.target?.alive) {
        bot.ai.think = 0.18 + Math.random() * 0.22;
        bot.ai.target = alive
          .filter((runner) => runner !== bot)
          .sort((a, b) => distanceSq(bot.x, bot.z, a.x, a.z) - distanceSq(bot.x, bot.z, b.x, b.z))[0];
        bot.ai.strafe *= Math.random() < 0.18 ? -1 : 1;
      }
      const target = bot.ai.target;
      if (!target) continue;
      const vector = normalize2(target.x - bot.x, target.z - bot.z);
      bot.setAim(vector.x, vector.z);
      const preferred = bot.definition.id === 'nova' ? 8.8 : 7.2;
      let moveX = vector.x * (vector.length > preferred ? 1 : vector.length < 4.5 ? -0.7 : 0.12);
      let moveZ = vector.z * (vector.length > preferred ? 1 : vector.length < 4.5 ? -0.7 : 0.12);
      moveX += -vector.z * bot.ai.strafe * 0.64;
      moveZ += vector.x * bot.ai.strafe * 0.64;
      if (this.arena.isVoid(bot.x + moveX * 1.4, bot.z + moveZ * 1.4)) {
        const inward = normalize2(-bot.x, -bot.z);
        moveX = inward.x;
        moveZ = inward.z;
        if (bot.dashCooldown <= 0) bot.dash(inward);
      }
      bot.move(normalize2(moveX, moveZ), dt);
      if (vector.length < 12 && Math.random() < dt * 4.6) bot.fire();
      if (bot.core >= 1 && (vector.length < 7 || bot.hp < bot.maxHp * 0.45)) bot.activateOverdrive();
    }
  }

  onRunnerDefeated(victim, source) {
    const killer = source ? source.name : 'THE VOID';
    this.hud.feed(`${killer} disconnected ${victim.name}`);
    const alive = this.runners.filter((runner) => runner.alive);
    if (victim === this.player) {
      this.end(false, alive.length + 1);
    } else if (this.player?.alive && alive.length === 1) {
      this.end(true, 1);
    } else if (this.player?.alive && alive.length === 2) {
      this.hud.banner('FINAL SIGNALS', 1.4, 'var(--magenta)');
    }
  }

  end(won, rank) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.input.enabled = false;
    this.endTimer = 1.25;
    this.pendingResult = { won, rank };
  }

  panFor(worldX) {
    if (!this.player) return 0;
    return clamp((worldX - this.player.x) / 14, -1, 1);
  }

  updateCamera(dt) {
    if (this.state === 'menu') {
      const angle = this.time * 0.08;
      this.camera.position.set(Math.sin(angle) * 25, 23, Math.cos(angle) * 25);
      this.camera.lookAt(0, 0, 0);
      return;
    }
    const target = this.player?.alive ? this.player : this.runners.find((runner) => runner.alive);
    if (!target) return;
    const leadX = target.isPlayer ? target.aim.x * 2 : 0;
    const leadZ = target.isPlayer ? target.aim.y * 2 : 0;
    this.cameraFocus.x += (target.x + leadX - this.cameraFocus.x) * (1 - Math.exp(-5 * dt));
    this.cameraFocus.z += (target.z + leadZ - this.cameraFocus.z) * (1 - Math.exp(-5 * dt));
    this.cameraShake *= Math.exp(-10 * dt);
    const shakeX = Math.sin(this.time * 49) * this.cameraShake;
    const shakeZ = Math.cos(this.time * 43) * this.cameraShake;
    this.camera.position.set(this.cameraFocus.x + 16 + shakeX, 24, this.cameraFocus.z + 18 + shakeZ);
    this.camera.lookAt(this.cameraFocus.x, 0, this.cameraFocus.z);
  }

  update(dt) {
    this.time += dt;
    if (this.state === 'menu') {
      const runner = this.runners[0];
      if (runner) {
        runner.setAim(Math.sin(this.time * 0.5), -1);
        runner.update(dt, this.time);
      }
      this.arena.update(dt, 0);
      this.updateCamera(dt);
      this.vfx.update(dt);
      return;
    }
    if (this.state === 'countdown') {
      this.countdown -= dt;
      const count = Math.ceil(this.countdown);
      if (count !== this.lastCount && count > 0) {
        this.lastCount = count;
        this.hud.banner(String(count), 0.7, 'var(--cyan)');
      }
      if (this.countdown <= 0) {
        this.state = 'playing';
        this.hud.banner('BREAK THE GRID', 1.1, 'var(--white)');
      }
    } else if (this.state === 'playing') {
      this.matchTime += dt;
      this.updatePlayer(dt);
      this.updateBots(dt);
      this.updateProjectiles(dt);
      this.updateShards(dt);
      if (this.matchTime >= GAME.maxMatchTime) this.end(this.player?.alive, this.runners.filter((runner) => runner.alive).length);
    } else if (this.state === 'ended') {
      this.endTimer -= dt;
      if (this.endTimer <= 0 && this.pendingResult) {
        const result = this.pendingResult;
        this.pendingResult = null;
        this.hud.showResult(result.won, this.player, result.rank, this.matchTime);
      }
    }
    this.arena.update(dt, this.matchTime);
    this.runners.forEach((runner) => runner.update(dt, this.time));
    this.vfx.update(dt);
    this.updateCamera(dt);
    this.hud.update(dt);
    this.renderer.markShadowsDirty();
  }

  loop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.update(dt);
    this.renderer.render(dt);
    requestAnimationFrame(this.loop);
  }
}
