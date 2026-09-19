// Engine classes are injected so the bundled renderer remains the single Three
// instance. The same geometry factory can be exercised without a GPU.
const geometryCaches = new WeakMap();

export function createVoltModel(T, hueShift = 0) {
  let cache = geometryCaches.get(T.Group);
  if (!cache) { cache = new Map(); geometryCaches.set(T.Group, cache); }
  const geometry = (key, factory) => {
    if (!cache.has(key)) cache.set(key, factory());
    return cache.get(key);
  };
  const rounded = (w, h, d, radius = 0.07) => geometry(`box:${w}:${h}:${d}:${radius}`, () => {
    const g = new T.BoxGeometry(w, h, d, 3, 3, 3);
    const p = g.attributes.position;
    const r = Math.min(radius, w / 2, h / 2, d / 2);
    const core = [w / 2 - r, h / 2 - r, d / 2 - r];
    for (let i = 0; i < p.count; i++) {
      const v = [p.getX(i), p.getY(i), p.getZ(i)];
      const q = v.map((n, j) => Math.max(-core[j], Math.min(core[j], n)));
      const length = Math.hypot(...v.map((n, j) => n - q[j])) || 1;
      p.setXYZ(i, ...q.map((n, j) => n + (v[j] - n) / length * r));
      g.attributes.normal.setXYZ(i, ...v.map((n, j) => (n - q[j]) / length));
    }
    return g;
  });
  const sphere = r => geometry(`sphere:${r}`, () => new T.SphereGeometry(r, 16, 12));
  const cylinder = (r, h) => geometry(`cylinder:${r}:${h}`, () => new T.CylinderGeometry(r, r, h, 16));
  const torus = (r, tube) => geometry(`torus:${r}:${tube}`, () => new T.TorusGeometry(r, tube, 6, 20));
  const materials = [];
  const material = (color, options = {}) => {
    const m = new T.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.18, ...options });
    materials.push(m);
    return m;
  };
  const paint = material(0xf4773b);
  const cream = material(0xffe4ac, { roughness: 0.46 });
  const dark = material(0x192d3a, { roughness: 0.58 });
  const rubber = material(0x122129, { roughness: 0.9, metalness: 0 });
  const steel = material(0x91aca8, { roughness: 0.28, metalness: 0.75 });
  const teal = material(0x29b8af);
  const visor = material(0x071d2c, { roughness: 0.17, metalness: 0.45 });
  const eye = material(0x8cfff0, { emissive: 0x49ebd7, emissiveIntensity: 2.0, metalness: 0 });
  const lamp = material(0xffd16a, { emissive: 0xff951e, emissiveIntensity: 1.4 });
  if (hueShift) paint.color.offsetHSL(hueShift * 0.3, 0, 0);
  const root = new T.Group();
  root.name = 'Volt / V-01';
  const body = new T.Group(); root.add(body);
  const mesh = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  };
  const box = (p, mat, w, h, d, x, y, z, r) => mesh(p, rounded(w, h, d, r), mat, x, y, z);
  const legs = [-1, 1].map(sign => {
    const g = new T.Group(); g.position.set(sign * 0.19, 0.4, 0); root.add(g);
    mesh(g, sphere(0.11), steel, 0, -0.04);
    box(g, paint, 0.21, 0.22, 0.23, 0, -0.14, 0);
    box(g, rubber, 0.28, 0.16, 0.38, 0, -0.29, 0.06, 0.055);
    box(g, cream, 0.26, 0.08, 0.17, 0, -0.23, 0.15, 0.03);
    return g;
  });
  const torso = box(body, paint, 0.66, 0.52, 0.45, 0, 0.69, 0, 0.13);
  box(body, dark, 0.52, 0.1, 0.44, 0, 0.43, 0, 0.04);
  box(body, cream, 0.39, 0.28, 0.06, 0, 0.72, 0.245, 0.055);
  // Chest badge: a bold lightning emblem made from two beveled bars.
  const badge = box(body, teal, 0.07, 0.15, 0.025, -0.02, 0.76, 0.286, 0.012);
  badge.rotation.z = -0.52;
  const badge2 = box(body, teal, 0.07, 0.12, 0.025, 0.02, 0.68, 0.286, 0.012);
  badge2.rotation.z = -0.52;
  box(body, teal, 0.48, 0.39, 0.19, 0, 0.75, -0.3, 0.075);
  for (let i = -1; i <= 1; i++) box(body, dark, 0.27, 0.035, 0.025, 0, 0.74 + i * 0.075, -0.405, 0.01);
  const head = new T.Group(); head.position.set(0, 1.13, 0); body.add(head);
  box(head, paint, 0.75, 0.51, 0.59, 0, 0, 0, 0.145);
  box(head, cream, 0.68, 0.135, 0.57, 0, 0.195, 0.01, 0.055);
  box(head, dark, 0.67, 0.29, 0.13, 0, -0.025, 0.277, 0.075);
  box(head, visor, 0.59, 0.22, 0.06, 0, -0.015, 0.35, 0.07);
  const eyes = [-1, 1].map(sign => box(head, eye, 0.085, 0.095, 0.025, sign * 0.135, 0.005, 0.387, 0.027));
  const mouth = box(head, eye, 0.11, 0.019, 0.022, 0.015, -0.079, 0.386, 0.008);
  mouth.rotation.z = 0.13;
  for (const sign of [-1, 1]) {
    const ear = mesh(head, cylinder(0.145, 0.12), dark, sign * 0.39, 0, 0); ear.rotation.z = Math.PI / 2;
    const hub = mesh(head, cylinder(0.087, 0.135), teal, sign * 0.4, 0, 0); hub.rotation.z = Math.PI / 2;
  }
  const antenna = new T.Group(); antenna.position.set(-0.23, 0.26, -0.03); antenna.rotation.z = 0.24; head.add(antenna);
  mesh(antenna, cylinder(0.025, 0.21), steel, 0, 0.09);
  mesh(antenna, sphere(0.063), lamp, 0, 0.22);
  const arms = [-1, 1].map(sign => {
    const g = new T.Group(); g.position.set(sign * 0.4, 0.82, 0); body.add(g);
    mesh(g, sphere(0.135), dark);
    box(g, cream, 0.24, 0.21, 0.27, 0, -0.005, 0, 0.075);
    box(g, paint, 0.17, 0.22, 0.19, 0, -0.2, 0, 0.06);
    const hand = box(g, dark, 0.19, 0.15, 0.22, 0, -0.33, 0.02, 0.05);
    g.userData.hand = hand; return g;
  });
  const weapon = new T.Group(); weapon.position.set(0.23, 0.65, 0.3); body.add(weapon);
  box(weapon, dark, 0.2, 0.23, 0.2, 0, -0.1, 0.04, 0.045);
  box(weapon, cream, 0.45, 0.37, 0.57, 0, 0.04, 0.21, 0.1);
  box(weapon, paint, 0.47, 0.13, 0.36, 0, 0.215, 0.15, 0.055);
  const barrel = new T.Group(); barrel.position.set(0, 0.04, 0.42); weapon.add(barrel);
  const sleeve = mesh(barrel, cylinder(0.21, 0.32), dark, 0, 0, 0.12); sleeve.rotation.x = Math.PI / 2;
  mesh(barrel, torus(0.2, 0.046), steel, 0, 0, 0.26);
  mesh(barrel, torus(0.142, 0.025), eye, 0, 0, 0.284);
  const bore = mesh(barrel, cylinder(0.126, 0.02), visor, 0, 0, 0.29); bore.rotation.x = Math.PI / 2;
  // Independent additive rings make the cannon visibly compress energy while
  // charging. They do not cast shadows and stay outside the merged mesh budget.
  const chargeMaterial = new T.MeshBasicMaterial({
    color: 0x8cfff0, transparent: true, opacity: 0,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide,
  });
  materials.push(chargeMaterial);
  const chargeRings = [0.17, 0.225].map((radius, i) => {
    const ring = mesh(barrel, torus(radius, 0.012 + i * 0.004), chargeMaterial, 0, 0, 0.315 + i * 0.018);
    ring.castShadow = false; ring.receiveShadow = false; ring.visible = false;
    return ring;
  });
  const fins = [];
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    const fin = box(barrel, paint, 0.12, 0.12, 0.27, Math.cos(a) * 0.235, Math.sin(a) * 0.235, 0.1, 0.035);
    fin.userData.angle = a; fins.push(fin);
  }
  const indicators = [];
  for (let i = 0; i < 3; i++) indicators.push(box(weapon, lamp, 0.065, 0.025, 0.09, -0.1 + i * 0.1, 0.287, 0.1, 0.008));
  arms[0].rotation.x = -1.0; arms[0].rotation.z = 0.5;
  arms[1].rotation.x = -1.3; arms[1].rotation.z = -0.16;
  // Combine static pieces with the same material within each animated joint.
  // Charge fins, eyes and ammo lights retain their independent transforms.
  const moving = new Set([...eyes, mouth, ...fins, ...indicators, ...chargeRings]);
  const groups = [];
  root.traverse(o => { if (o.isGroup) groups.push(o); });
  groups.forEach((parent, groupIndex) => {
    materials.forEach((mat, materialIndex) => {
      const parts = parent.children.filter(o => o.isMesh && o.material === mat && !moving.has(o));
      if (parts.length < 2) return;
      const merged = geometry(`merged:${groupIndex}:${materialIndex}`, () => {
        const sources = parts.map(part => {
          part.updateMatrix();
          return part.geometry.toNonIndexed().applyMatrix4(part.matrix);
        });
        const result = sources[0].clone();
        for (const name of ['position', 'normal', 'uv']) {
          const data = new Float32Array(sources.reduce((n, g) => n + g.attributes[name].array.length, 0));
          let offset = 0;
          for (const source of sources) { data.set(source.attributes[name].array, offset); offset += source.attributes[name].array.length; }
          const attr = sources[0].attributes[name];
          result.setAttribute(name, new attr.constructor(data, attr.itemSize));
        }
        result.clearGroups(); result.computeBoundingBox(); result.computeBoundingSphere();
        sources.forEach(g => g.dispose());
        return result;
      });
      parts.forEach(part => parent.remove(part));
      mesh(parent, merged, mat);
    });
  });
  return {
    root, body, torso, head, legs, arms, weapon,
    muzzles: [new T.Vector3(0.23, 0.69, 1.01)],
    pose: { armBase: [[-1, 0.5], [-1.3, -0.16]] },
    flashMats: [paint, cream, dark, steel, teal], allMats: materials,
    volt: { eyes, mouth, antenna, barrel, fins, indicators, eye, lamp, chargeRings, chargeMaterial },
  };
}

export function animateVolt(runner, dt) {
  const model = runner.model;
  if (!model.volt) return;
  const { eyes, mouth, antenna, barrel, fins, indicators, eye, lamp, chargeRings, chargeMaterial } = model.volt;
  const t = runner.game.elapsed;
  const charge = Math.min(1, (runner.voltCharge || 0) / 0.85);
  const firing = runner.recoil;
  const blink = Math.sin(t * 0.83 + runner.id * 2.1) > 0.997 ? 0.12 : 1;
  eyes.forEach((e, i) => {
    e.scale.y = blink * (charge > 0.15 ? 0.6 : 1);
    e.rotation.z = charge * (i === 0 ? -0.22 : 0.22);
  });
  mouth.scale.x = 1 + firing * 0.6;
  antenna.rotation.z = 0.24 + Math.sin(t * 3.4) * 0.045 + firing * 0.3;
  barrel.position.z = 0.42 - firing * 0.095;
  barrel.rotation.z += dt * (charge * charge * 9 + firing * 5);
  for (const fin of fins) {
    const radius = 0.235 - charge * 0.055;
    fin.position.x = Math.cos(fin.userData.angle) * radius;
    fin.position.y = Math.sin(fin.userData.angle) * radius;
  }
  indicators.forEach((m, i) => { m.scale.y = runner.ammo > i ? 1 : 0.15; });
  eye.emissiveIntensity = 1.6 + charge * 2.5;
  lamp.emissiveIntensity = 1.2 + charge * (1.2 + Math.sin(t * 24) * 0.5);
  const chargeVisible = charge > 0.08;
  chargeMaterial.opacity = chargeVisible ? 0.18 + charge * 0.62 : 0;
  chargeRings.forEach((ring, i) => {
    ring.visible = chargeVisible;
    ring.rotation.z += dt * (5 + charge * 15) * (i ? -1 : 1);
    const pulse = 1 + Math.sin(t * (12 + i * 3)) * 0.06 * charge;
    ring.scale.setScalar((0.82 + charge * 0.22 + i * 0.05) * pulse);
  });
  model.head.rotation.y = Math.sin(t * 1.3 + runner.id) * 0.025;
  model.body.rotation.z = -runner.moveX * 0.045;
  model.arms[1].rotation.x = model.pose.armBase[1][0] - firing * 0.12;
}
