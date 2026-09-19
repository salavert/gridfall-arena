import * as THREE from 'three';
import { GAME, PALETTE } from '../config.js';
import { circleIntersectsBox, clamp, mulberry32, seededRange } from '../core/math.js';
import { collapseRadius } from '../core/rules.js';
import { createGlowSprite, roundedBox, stylizedMaterial } from '../rendering/Visuals.js';

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();

export class Arena {
  constructor(scene, vfx, seed = Date.now()) {
    this.scene = scene;
    this.vfx = vfx;
    this.seed = seed;
    this.random = mulberry32(seed);
    this.group = new THREE.Group();
    this.group.name = 'gridfall-arena';
    scene.add(this.group);
    this.tiles = [];
    this.colliders = [];
    this.relays = [];
    this.safeRadius = GAME.arenaSize * 0.72;
    this.dirtyTiles = true;
    this.buildPlatform();
    this.buildCover();
    this.buildRelays();
    this.buildBackdrop();
  }

  buildPlatform() {
    const count = GAME.tileCount;
    const tileSize = GAME.arenaSize / count;
    this.tileSize = tileSize;
    const geometry = new THREE.BoxGeometry(tileSize * 0.92, 0.42, tileSize * 0.92);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.58, metalness: 0.42, vertexColors: true });
    this.tileMesh = new THREE.InstancedMesh(geometry, material, count * count);
    this.tileMesh.receiveShadow = true;
    this.tileMesh.castShadow = true;
    this.tileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const baseColor = new THREE.Color(PALETTE.grid);
    for (let row = 0; row < count; row += 1) {
      for (let column = 0; column < count; column += 1) {
        const id = row * count + column;
        const x = (column - (count - 1) / 2) * tileSize;
        const z = (row - (count - 1) / 2) * tileSize;
        const tile = { id, x, z, state: 'active', warning: 0, fall: 0, relayVoid: false };
        this.tiles.push(tile);
        matrix.compose(position.set(x, -0.24, z), quaternion.identity(), scale.set(1, 1, 1));
        this.tileMesh.setMatrixAt(id, matrix);
        const noise = seededRange(this.random, -0.035, 0.055);
        this.tileMesh.setColorAt(id, baseColor.clone().offsetHSL(noise, 0.02, noise));
      }
    }
    this.group.add(this.tileMesh);

    const underlay = new THREE.Mesh(
      new THREE.CylinderGeometry(GAME.arenaSize * 0.72, GAME.arenaSize * 0.62, 1.8, 8),
      stylizedMaterial({ color: 0x0b1026, metalness: 0.75, roughness: 0.35 }),
    );
    underlay.rotation.y = Math.PI / 8;
    underlay.position.y = -1.35;
    underlay.receiveShadow = true;
    this.group.add(underlay);

    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(GAME.arenaSize * 0.69, 0.12, 8, 96),
      stylizedMaterial({ color: PALETTE.cyan, emissive: PALETTE.cyan, emissiveIntensity: 2.2, roughness: 0.25 }),
    );
    edge.rotation.x = Math.PI / 2;
    edge.position.y = -0.18;
    this.group.add(edge);
  }

  buildCover() {
    const primary = stylizedMaterial({ color: 0x263158, metalness: 0.65, roughness: 0.38 });
    const inset = stylizedMaterial({ color: 0x10162d, metalness: 0.5, roughness: 0.52 });
    const accent = stylizedMaterial({ color: PALETTE.magenta, emissive: PALETTE.magenta, emissiveIntensity: 1.6, roughness: 0.3 });
    const layouts = [
      [5.8, 5.4, 3.2, 1.7], [8.3, -1.2, 2.2, 3.6], [4.1, -7.5, 4.1, 1.5],
      [0, 7.9, 3.4, 1.7], [0, -7.9, 3.4, 1.7],
    ];
    const placements = [];
    for (const layout of layouts) {
      const [x, z, width, depth] = layout;
      placements.push([x, z, width, depth]);
      if (x !== 0) placements.push([-x, -z, width, depth]);
    }
    placements.forEach(([x, z, width, depth], index) => {
      const height = 1.45 + (index % 3) * 0.22;
      const block = roundedBox(width, height, depth, 0.25, primary);
      block.position.set(x, height / 2, z);
      this.group.add(block);
      const panel = roundedBox(width * 0.65, height * 0.18, depth + 0.04, 0.06, index % 2 ? accent : inset);
      panel.position.set(x, height * 0.62, z);
      this.group.add(panel);
      this.colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
    });
  }

  buildRelays() {
    const positions = [[-10.8, -10.2], [10.8, -10.2], [10.8, 10.2], [-10.8, 10.2]];
    positions.forEach(([x, z], index) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.5, 0.6, 8),
        stylizedMaterial({ color: 0x1d274a, metalness: 0.72, roughness: 0.3 }),
      );
      base.position.y = 0.3;
      base.castShadow = true;
      group.add(base);
      const cage = new THREE.Mesh(
        new THREE.TorusKnotGeometry(0.48, 0.12, 48, 8, 2, 3),
        stylizedMaterial({ color: index % 2 ? PALETTE.magenta : PALETTE.cyan, emissive: index % 2 ? PALETTE.magenta : PALETTE.cyan, emissiveIntensity: 2.4, roughness: 0.22 }),
      );
      cage.position.y = 1.35;
      cage.castShadow = true;
      group.add(cage);
      const glow = createGlowSprite(index % 2 ? PALETTE.magenta : PALETTE.cyan, 3.2);
      glow.position.y = 1.35;
      group.add(glow);
      this.group.add(group);
      this.relays.push({ id: index, x, z, hp: 90, maxHp: 90, state: 'active', fuse: 0, group, cage, glow, radius: 4.4 });
    });
  }

  buildBackdrop() {
    const count = 54;
    const geometry = new THREE.IcosahedronGeometry(0.14, 0);
    const material = new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.22 });
    const motes = new THREE.InstancedMesh(geometry, material, count);
    for (let index = 0; index < count; index += 1) {
      const angle = this.random() * Math.PI * 2;
      const radius = seededRange(this.random, 22, 42);
      matrix.compose(
        position.set(Math.cos(angle) * radius, seededRange(this.random, -5, 8), Math.sin(angle) * radius),
        quaternion.identity(),
        scale.setScalar(seededRange(this.random, 0.4, 1.8)),
      );
      motes.setMatrixAt(index, matrix);
    }
    this.group.add(motes);
  }

  damageRelay(x, z, radius, damage) {
    for (const relay of this.relays) {
      if (relay.state !== 'active' || Math.hypot(x - relay.x, z - relay.z) > radius + 1.1) continue;
      relay.hp -= damage;
      relay.cage.scale.setScalar(1 + (1 - relay.hp / relay.maxHp) * 0.22);
      let triggered = false;
      if (relay.hp <= 0) {
        relay.state = 'fusing';
        relay.fuse = GAME.relayFuse;
        triggered = true;
      }
      return { relay, triggered };
    }
    return null;
  }

  isVoid(x, z) {
    if (Math.hypot(x, z) > this.safeRadius) return true;
    for (const relay of this.relays) {
      if (relay.state === 'severed' && Math.hypot(x - relay.x, z - relay.z) < relay.radius) return true;
    }
    return false;
  }

  collides(x, z, radius = 0.55) {
    if (Math.abs(x) > GAME.arenaSize / 2 - radius || Math.abs(z) > GAME.arenaSize / 2 - radius) return true;
    return this.colliders.some((box) => circleIntersectsBox(x, z, radius, box));
  }

  resolveMove(fromX, fromZ, toX, toZ, radius = 0.55) {
    let x = clamp(toX, -GAME.arenaSize / 2 + radius, GAME.arenaSize / 2 - radius);
    let z = clamp(toZ, -GAME.arenaSize / 2 + radius, GAME.arenaSize / 2 - radius);
    if (this.collides(x, fromZ, radius)) x = fromX;
    if (this.collides(x, z, radius)) z = fromZ;
    return { x, z };
  }

  update(dt, matchTime) {
    if (matchTime > GAME.collapseStart) {
      this.safeRadius = collapseRadius(matchTime, GAME);
    }
    for (const relay of this.relays) {
      relay.cage.rotation.x += dt * (relay.state === 'fusing' ? 8 : 1.2);
      relay.cage.rotation.y += dt * (relay.state === 'fusing' ? 11 : 1.8);
      if (relay.state === 'fusing') {
        relay.fuse -= dt;
        relay.glow.material.opacity = 0.45 + Math.sin(relay.fuse * 24) * 0.3;
        if (relay.fuse <= 0) {
          relay.state = 'severed';
          relay.group.visible = false;
          this.vfx.emit(relay.x, 1.2, relay.z, PALETTE.magenta, 56, { speed: 8, lift: 4, life: 1.1, size: 25, gravity: 6 });
          this.vfx.ring(relay.x, relay.z, PALETTE.magenta, 0.7, 0.8);
          this.dirtyTiles = true;
        }
      }
    }
    this.updateTiles(matchTime);
  }

  updateTiles(matchTime) {
    const pulse = (Math.sin(matchTime * 4.2) + 1) * 0.5;
    let changed = this.dirtyTiles;
    for (const tile of this.tiles) {
      const radial = Math.hypot(tile.x, tile.z);
      const outside = radial > this.safeRadius;
      const nearEdge = !outside && radial > this.safeRadius - 2.2;
      const relayVoid = this.relays.some((relay) => relay.state === 'severed' && Math.hypot(tile.x - relay.x, tile.z - relay.z) < relay.radius);
      const relayWarning = this.relays.some((relay) => relay.state === 'fusing' && Math.hypot(tile.x - relay.x, tile.z - relay.z) < relay.radius);
      const nextState = outside || relayVoid ? 'off' : nearEdge || relayWarning ? 'warning' : 'active';
      if (nextState !== tile.state) changed = true;
      tile.state = nextState;
      tile.fall += ((nextState === 'off' ? 1 : 0) - tile.fall) * 0.08;
      const y = -0.24 - tile.fall * (1.8 + (tile.id % 4) * 0.18);
      matrix.compose(position.set(tile.x, y, tile.z), quaternion.identity(), scale.set(1, 1 - tile.fall * 0.55, 1));
      this.tileMesh.setMatrixAt(tile.id, matrix);
      const color = nextState === 'off'
        ? new THREE.Color(PALETTE.void).multiplyScalar(0.12 + pulse * 0.08)
        : nextState === 'warning'
          ? new THREE.Color(PALETTE.danger).multiplyScalar(0.45 + pulse * 0.25)
          : new THREE.Color(PALETTE.grid).offsetHSL((tile.id % 5) * 0.004, 0, (tile.id % 3) * 0.012);
      this.tileMesh.setColorAt(tile.id, color);
    }
    this.tileMesh.instanceMatrix.needsUpdate = true;
    this.tileMesh.instanceColor.needsUpdate = true;
    this.dirtyTiles = false;
    return changed;
  }

  spawnPoints() {
    return [[0, 13], [0, -13], [13, 0], [-13, 0], [9, 9], [-9, 9], [9, -9], [-9, -9]];
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((object) => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
    });
  }
}
