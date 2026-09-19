import * as THREE from 'three';
import { GAME } from '../config.js';
import { clamp, damp, normalize2 } from '../core/math.js';
import { weaponLevelForShards } from '../core/rules.js';
import { animateRunner, createRunnerModel } from '../rendering/Visuals.js';

let nextRunnerId = 1;

export class Runner {
  constructor(game, definition, { x, z, isPlayer = false, name = definition.name }) {
    this.id = nextRunnerId++;
    this.game = game;
    this.definition = definition;
    this.name = name;
    this.isPlayer = isPlayer;
    this.position = new THREE.Vector3(x, 0, z);
    this.velocity = new THREE.Vector2();
    this.aim = new THREE.Vector2(0, -1);
    this.root = createRunnerModel(definition, isPlayer);
    this.root.userData.isPlayer = isPlayer;
    this.root.position.copy(this.position);
    game.scene.add(this.root);
    this.hp = definition.hp;
    this.maxHp = definition.hp;
    this.alive = true;
    this.fireCooldown = Math.random() * 0.2;
    this.heat = 0;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.invulnerable = 0;
    this.overdrive = 0;
    this.core = 0;
    this.shards = 0;
    this.kills = 0;
    this.recoil = 0;
    this.voidTick = 0;
    this.lastDamager = null;
    this.ai = { think: 0, target: null, strafe: Math.random() > 0.5 ? 1 : -1, wander: new THREE.Vector2() };
  }

  get x() { return this.position.x; }
  get z() { return this.position.z; }
  get weaponLevel() { return weaponLevelForShards(this.shards); }

  setAim(x, z) {
    const normalized = normalize2(x, z);
    if (normalized.length > 0) this.aim.set(normalized.x, normalized.z);
  }

  move(direction, dt) {
    if (!this.alive) return;
    const targetSpeed = this.definition.speed * (this.overdrive > 0 ? 1.16 : 1);
    const targetX = direction.x * targetSpeed;
    const targetZ = direction.z * targetSpeed;
    this.velocity.x = damp(this.velocity.x, targetX, this.dashTime > 0 ? 1.5 : 11, dt);
    this.velocity.y = damp(this.velocity.y, targetZ, this.dashTime > 0 ? 1.5 : 11, dt);
    const resolved = this.game.arena.resolveMove(this.x, this.z, this.x + this.velocity.x * dt, this.z + this.velocity.y * dt, 0.52);
    if (resolved.x === this.x) this.velocity.x *= -0.12;
    if (resolved.z === this.z) this.velocity.y *= -0.12;
    this.position.x = resolved.x;
    this.position.z = resolved.z;
  }

  dash(direction) {
    if (!this.alive || this.dashCooldown > 0) return false;
    const vector = direction.length > 0.1 ? direction : { x: this.aim.x, z: this.aim.y };
    this.velocity.set(vector.x * this.definition.dash * 2.35, vector.z * this.definition.dash * 2.35);
    this.dashTime = 0.24;
    this.dashCooldown = this.definition.id === 'flux' ? GAME.dashCooldown * 0.76 : GAME.dashCooldown;
    this.invulnerable = 0.26;
    this.game.vfx.ring(this.x, this.z, this.definition.color, 0.45, 0.28);
    this.game.vfx.emit(this.x, 0.5, this.z, this.definition.color, 18, { speed: 4.5, lift: 1.2, life: 0.38, size: 16, gravity: 1 });
    this.game.audio.play('dash', this.game.panFor(this.x));
    return true;
  }

  fire() {
    if (!this.alive || this.fireCooldown > 0 || this.heat >= 1) return false;
    const level = this.weaponLevel;
    const count = level === 1 ? 1 : level === 2 ? 2 : 3;
    const spread = level === 1 ? 0 : level === 2 ? 0.07 : 0.12;
    for (let index = 0; index < count; index += 1) {
      const offset = (index - (count - 1) / 2) * spread;
      const angle = Math.atan2(this.aim.x, this.aim.y) + offset;
      this.game.spawnProjectile(this, Math.sin(angle), Math.cos(angle));
    }
    this.fireCooldown = this.definition.fireRate * (this.overdrive > 0 ? 0.55 : 1);
    this.heat = clamp(this.heat + 0.15 + count * 0.035, 0, 1.2);
    this.recoil = 1;
    this.root.userData.visual.muzzle.visible = true;
    this.game.audio.play('shot', this.game.panFor(this.x));
    return true;
  }

  activateOverdrive() {
    if (!this.alive || this.core < 1) return false;
    this.core = 0;
    this.overdrive = GAME.overdriveDuration;
    this.game.vfx.ring(this.x, this.z, this.definition.accent, 0.7, 0.8);
    this.game.vfx.emit(this.x, 1, this.z, this.definition.accent, 32, { speed: 5.5, lift: 3, life: 0.75, size: 22, gravity: 2 });
    this.game.audio.play('overdrive', this.game.panFor(this.x));
    return true;
  }

  damage(amount, source) {
    if (!this.alive || this.invulnerable > 0) return false;
    this.hp -= amount;
    this.lastDamager = source;
    this.invulnerable = 0.06;
    this.game.vfx.emit(this.x, 1.1, this.z, this.definition.color, 9, { speed: 3.2, lift: 2.2, life: 0.38, size: 15 });
    this.game.audio.play('hit', this.game.panFor(this.x));
    if (this.isPlayer) this.game.hud.flashDamage();
    if (this.hp <= 0) this.defeat(source);
    return true;
  }

  defeat(source) {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.root.visible = false;
    this.game.vfx.emit(this.x, 1.2, this.z, this.definition.color, 42, { speed: 7, lift: 4.5, life: 0.95, size: 24, gravity: 5 });
    this.game.vfx.ring(this.x, this.z, this.definition.color, 0.7, 0.65);
    this.game.audio.play('down', this.game.panFor(this.x));
    if (source && source !== this) {
      source.kills += 1;
      source.core = clamp(source.core + 0.34, 0, 1);
      this.game.spawnShard(this.x, this.z, source.definition.color);
    }
    this.game.onRunnerDefeated(this, source);
  }

  update(dt, time) {
    if (!this.alive) return;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.overdrive = Math.max(0, this.overdrive - dt);
    this.heat = Math.max(0, this.heat - dt * (this.heat > 1 ? 0.42 : 0.29));
    this.recoil = damp(this.recoil, 0, 17, dt);
    if (this.root.userData.visual.muzzle.visible && this.recoil < 0.45) this.root.userData.visual.muzzle.visible = false;

    if (this.game.arena.isVoid(this.x, this.z)) {
      this.voidTick -= dt;
      if (this.voidTick <= 0) {
        this.voidTick = 0.34;
        this.damage(8, null);
      }
    } else {
      this.voidTick = 0;
    }
    this.position.y = this.dashTime > 0 ? Math.sin((this.dashTime / 0.24) * Math.PI) * 0.22 : 0;
    this.root.position.copy(this.position);
    const speed = this.velocity.length();
    const aimAngle = Math.atan2(this.aim.x, this.aim.y);
    animateRunner(this.root, speed, time, aimAngle, this.recoil, this.overdrive > 0);
  }

  dispose() {
    this.game.scene.remove(this.root);
  }
}
