import * as THREE from 'three';
import { normalize2 } from './math.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pointer = new THREE.Vector2();
    this.pointerPixels = { x: innerWidth / 2, y: innerHeight / 2 };
    this.firing = false;
    this.dashQueued = false;
    this.overdriveQueued = false;
    this.enabled = false;

    addEventListener('keydown', (event) => this.onKey(event, true));
    addEventListener('keyup', (event) => this.onKey(event, false));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointermove', (event) => this.onPointer(event));
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button === 0) this.firing = true;
      this.onPointer(event);
    });
    addEventListener('pointerup', (event) => {
      if (event.button === 0) this.firing = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  onKey(event, down) {
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
    if (!this.enabled) return;
    down ? this.keys.add(event.code) : this.keys.delete(event.code);
    if (down && !event.repeat && event.code === 'Space') this.dashQueued = true;
    if (down && !event.repeat && event.code === 'KeyE') this.overdriveQueued = true;
  }

  onPointer(event) {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointerPixels.x = event.clientX;
    this.pointerPixels.y = event.clientY;
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  }

  movement() {
    const x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const z = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'));
    return normalize2(x, z);
  }

  consumeDash() {
    const queued = this.dashQueued;
    this.dashQueued = false;
    return queued;
  }

  consumeOverdrive() {
    const queued = this.overdriveQueued;
    this.overdriveQueued = false;
    return queued;
  }
}
