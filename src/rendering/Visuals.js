import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const shared = new Map();

export function stylizedMaterial({ color, emissive = 0x000000, emissiveIntensity = 0, metalness = 0.1, roughness = 0.62 }) {
  const key = [color, emissive, emissiveIntensity, metalness, roughness].join(':');
  if (shared.has(key)) return shared.get(key);
  const material = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, metalness, roughness });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vGridWorldY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGridWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGridWorldY;')
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        float gridVertical = smoothstep(-0.4, 2.6, vGridWorldY);
        float gridRim = pow(1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0), 2.6);
        gl_FragColor.rgb *= mix(0.82, 1.08, gridVertical);
        gl_FragColor.rgb += gridRim * 0.075;
      `);
  };
  material.customProgramCacheKey = () => 'gridfall-stylized-v1';
  shared.set(key, material);
  return material;
}

export function roundedBox(width, height, depth, radius, material) {
  const geometry = new RoundedBoxGeometry(width, height, depth, 2, radius);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createGlowSprite(color, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,.8)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,.2)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(scale);
  return sprite;
}

export function createRunnerModel(definition, isPlayer = false) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const primary = stylizedMaterial({ color: definition.color, metalness: 0.34, roughness: 0.42 });
  const dark = stylizedMaterial({ color: 0x131a31, metalness: 0.55, roughness: 0.34 });
  const light = stylizedMaterial({ color: 0xdffcff, metalness: 0.18, roughness: 0.4 });
  const glow = stylizedMaterial({ color: definition.accent, emissive: definition.accent, emissiveIntensity: 2.3, metalness: 0.1, roughness: 0.25 });

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 64;
  shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d');
  const shadowGradient = shadowContext.createRadialGradient(32, 32, 3, 32, 32, 31);
  shadowGradient.addColorStop(0, 'rgba(0,0,0,.5)');
  shadowGradient.addColorStop(1, 'rgba(0,0,0,0)');
  shadowContext.fillStyle = shadowGradient;
  shadowContext.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 2.5),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, opacity: 0.65 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  root.add(shadow);

  const torso = roundedBox(0.96, 1.05, 0.72, 0.22, primary);
  torso.position.y = 1.18;
  body.add(torso);
  const chest = roundedBox(0.7, 0.18, 0.78, 0.07, glow);
  chest.position.set(0, 1.27, -0.05);
  body.add(chest);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), light);
  head.scale.y = 0.8;
  head.position.y = 1.93;
  head.castShadow = true;
  body.add(head);
  const visor = roundedBox(0.55, 0.17, 0.2, 0.06, dark);
  visor.position.set(0, 1.97, -0.34);
  body.add(visor);
  const visorLight = roundedBox(0.36, 0.055, 0.215, 0.02, glow);
  visorLight.position.set(0, 1.98, -0.36);
  body.add(visorLight);

  const limbs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.3, 0.78, 0);
    const leg = roundedBox(0.32, 0.72, 0.38, 0.12, dark);
    leg.position.y = -0.3;
    hip.add(leg);
    const boot = roundedBox(0.38, 0.23, 0.58, 0.1, primary);
    boot.position.set(0, -0.68, -0.08);
    hip.add(boot);
    body.add(hip);

    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.67, 1.55, 0);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 8), primary);
    cap.scale.set(1, 0.8, 1);
    cap.castShadow = true;
    shoulder.add(cap);
    const arm = roundedBox(0.25, 0.64, 0.28, 0.1, dark);
    arm.position.y = -0.37;
    shoulder.add(arm);
    body.add(shoulder);
    limbs.push({ hip, shoulder, side });
  }

  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.58, 1.28, -0.28);
  const weapon = roundedBox(0.42, 0.32, 1.25, 0.1, dark);
  weapon.position.z = -0.38;
  weaponPivot.add(weapon);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.7, 12), glow);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -1.03);
  barrel.castShadow = true;
  weaponPivot.add(barrel);
  const muzzle = createGlowSprite(definition.accent, 0.9);
  muzzle.position.set(0, 0.02, -1.42);
  muzzle.visible = false;
  weaponPivot.add(muzzle);
  body.add(weaponPivot);

  if (definition.id === 'rook') {
    const shield = roundedBox(0.2, 1.1, 0.88, 0.18, primary);
    shield.position.set(-0.76, 1.28, -0.15);
    body.add(shield);
  } else if (definition.id === 'nova') {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 20), glow);
    coil.position.set(0, 1.2, 0.43);
    coil.rotation.x = Math.PI / 2;
    body.add(coil);
  } else {
    for (const side of [-1, 1]) {
      const fin = roundedBox(0.1, 0.62, 0.5, 0.04, primary);
      fin.position.set(side * 0.54, 1.16, 0.34);
      fin.rotation.z = side * -0.25;
      body.add(fin);
    }
  }

  const playerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 0.85, 48),
    new THREE.MeshBasicMaterial({ color: definition.color, transparent: true, opacity: isPlayer ? 0.85 : 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  playerRing.rotation.x = -Math.PI / 2;
  playerRing.position.y = 0.05;
  root.add(playerRing);

  root.userData.visual = { body, limbs, weaponPivot, muzzle, playerRing, stride: Math.random() * Math.PI * 2 };
  return root;
}

export function animateRunner(root, speed, time, aimAngle, recoil = 0, overdrive = false) {
  const visual = root.userData.visual;
  if (!visual) return;
  visual.stride += speed * 0.13;
  const movement = Math.min(1, speed / 6);
  const swing = Math.sin(visual.stride * 7) * 0.46 * movement;
  visual.body.position.y = Math.abs(Math.sin(visual.stride * 7)) * 0.075 * movement;
  visual.body.rotation.y = aimAngle;
  visual.body.scale.setScalar(1 + Math.sin(time * 12) * 0.018 * Number(overdrive));
  visual.limbs.forEach(({ hip, shoulder, side }) => {
    hip.rotation.x = swing * side;
    shoulder.rotation.x = -swing * side * 0.65;
  });
  visual.weaponPivot.position.z = -recoil * 0.22;
  const targetOpacity = overdrive ? 0.95 : root.userData.isPlayer ? 0.8 : 0.18;
  visual.playerRing.material.opacity += (targetOpacity - visual.playerRing.material.opacity) * 0.08;
}
