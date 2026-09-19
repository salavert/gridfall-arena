import * as THREE from 'three';
import { createGlowSprite } from '../rendering/Visuals.js';

const MAX_PARTICLES = 900;

export class VfxSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({ life: 0, position: new THREE.Vector3(), velocity: new THREE.Vector3(), size: 0 }));
    this.cursor = 0;
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);
    this.alphas = new Float32Array(MAX_PARTICLES);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: Math.min(devicePixelRatio, 2) } },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = aAlpha;
          vec4 view = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * view;
          gl_PointSize = aSize * min(2.0, 260.0 / max(1.0, -view.z));
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float distanceToCenter = length(gl_PointCoord - 0.5);
          float alpha = smoothstep(0.5, 0.06, distanceToCenter) * vAlpha;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.rings = [];
  }

  emit(x, y, z, color, count = 8, options = {}) {
    const tint = new THREE.Color(color);
    for (let index = 0; index < count; index += 1) {
      const particle = this.particles[this.cursor++ % MAX_PARTICLES];
      const angle = Math.random() * Math.PI * 2;
      const speed = (options.speed || 3) * (0.35 + Math.random() * 0.9);
      particle.position.set(x, y, z);
      particle.velocity.set(Math.cos(angle) * speed, (options.lift ?? 1.8) * (0.4 + Math.random()), Math.sin(angle) * speed);
      particle.life = particle.maxLife = (options.life || 0.55) * (0.7 + Math.random() * 0.6);
      particle.size = (options.size || 18) * (0.6 + Math.random() * 0.8);
      particle.gravity = options.gravity ?? 4.5;
      particle.drag = options.drag ?? 2.2;
      particle.color = tint;
    }
  }

  trail(x, y, z, color) {
    this.emit(x, y, z, color, 1, { speed: 0.25, lift: 0.1, life: 0.2, size: 11, gravity: 0, drag: 5 });
  }

  ring(x, z, color, radius = 0.5, duration = 0.45) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.09, z);
    mesh.scale.setScalar(radius);
    mesh.userData = { life: duration, maxLife: duration, radius, target: radius * 5.5 };
    this.rings.push(mesh);
    this.scene.add(mesh);
  }

  flash(sceneObject, color, size = 2) {
    const sprite = createGlowSprite(color, size);
    sprite.position.copy(sceneObject.position);
    sprite.position.y += 1;
    sprite.userData.life = 0.14;
    this.scene.add(sprite);
    this.rings.push(sprite);
  }

  update(dt) {
    for (let index = 0; index < MAX_PARTICLES; index += 1) {
      const particle = this.particles[index];
      const offset = index * 3;
      if (particle.life <= 0) {
        this.alphas[index] = 0;
        continue;
      }
      particle.life -= dt;
      particle.velocity.multiplyScalar(Math.exp(-particle.drag * dt));
      particle.velocity.y -= particle.gravity * dt;
      particle.position.addScaledVector(particle.velocity, dt);
      this.positions[offset] = particle.position.x;
      this.positions[offset + 1] = particle.position.y;
      this.positions[offset + 2] = particle.position.z;
      this.colors[offset] = particle.color.r;
      this.colors[offset + 1] = particle.color.g;
      this.colors[offset + 2] = particle.color.b;
      this.sizes[index] = particle.size;
      this.alphas[index] = Math.max(0, particle.life / particle.maxLife);
    }
    for (const attribute of ['position', 'color', 'aSize', 'aAlpha']) this.geometry.attributes[attribute].needsUpdate = true;

    for (let index = this.rings.length - 1; index >= 0; index -= 1) {
      const ring = this.rings[index];
      ring.userData.life -= dt;
      if (ring.isSprite) {
        ring.material.opacity = Math.max(0, ring.userData.life / 0.14);
        ring.scale.multiplyScalar(1 + dt * 9);
      } else {
        const progress = 1 - ring.userData.life / ring.userData.maxLife;
        const scale = THREE.MathUtils.lerp(ring.userData.radius, ring.userData.target, 1 - (1 - progress) ** 3);
        ring.scale.setScalar(scale);
        ring.material.opacity = Math.max(0, 1 - progress);
      }
      if (ring.userData.life <= 0) {
        this.scene.remove(ring);
        ring.geometry?.dispose();
        ring.material.dispose();
        this.rings.splice(index, 1);
      }
    }
  }
}
