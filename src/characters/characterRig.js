export const SIDEKICK_HUMANOID_ROLES = Object.freeze({
  hips: Object.freeze(['hips', 'pelvis']),
  spine: Object.freeze(['spine', 'spine01', 'spine1']),
  chest: Object.freeze(['chest', 'upperchest', 'spine02', 'spine2', 'spine03', 'spine3']),
  neck: Object.freeze(['neck', 'neck01', 'neck1']),
  head: Object.freeze(['head']),
  leftShoulder: Object.freeze(['leftshoulder', 'shoulderl', 'claviclel']),
  leftUpperArm: Object.freeze(['leftupperarm', 'upperarml', 'upperarml']),
  leftLowerArm: Object.freeze(['leftlowerarm', 'lowerarml', 'forearml']),
  leftHand: Object.freeze(['lefthand', 'handl']),
  rightShoulder: Object.freeze(['rightshoulder', 'shoulderr', 'clavicler']),
  rightUpperArm: Object.freeze(['rightupperarm', 'upperarmr', 'upperarmr']),
  rightLowerArm: Object.freeze(['rightlowerarm', 'lowerarmr', 'forearmr']),
  rightHand: Object.freeze(['righthand', 'handr']),
  leftUpperLeg: Object.freeze(['leftupperleg', 'thighl', 'uplegl']),
  leftLowerLeg: Object.freeze(['leftlowerleg', 'calfl', 'shinl']),
  leftFoot: Object.freeze(['leftfoot', 'footl']),
  rightUpperLeg: Object.freeze(['rightupperleg', 'thighr', 'uplegr']),
  rightLowerLeg: Object.freeze(['rightlowerleg', 'calfr', 'shinr']),
  rightFoot: Object.freeze(['rightfoot', 'footr']),
});

export const SIDEKICK_REQUIRED_ROLES = Object.freeze([
  'hips',
  'spine',
  'head',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
  'leftUpperLeg',
  'leftLowerLeg',
  'leftFoot',
  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
]);

export const SIDEKICK_SOCKETS = Object.freeze({
  head: 'head',
  leftHand: 'leftHand',
  rightHand: 'rightHand',
  leftFoot: 'leftFoot',
  rightFoot: 'rightFoot',
});

export function normalizeBoneName(name) {
  return String(name ?? '')
    .split(/[|:/]/)
    .at(-1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function findBoneName(names, aliases) {
  const normalized = names.map(name => [name, normalizeBoneName(name)]);
  for (const alias of aliases) {
    const exact = normalized.find(([, value]) => value === alias);
    if (exact) return exact[0];
  }
  for (const alias of aliases) {
    const suffix = normalized.find(([, value]) => value.endsWith(alias));
    if (suffix) return suffix[0];
  }
  return null;
}

export function resolveHumanoidRig(names, roles = SIDEKICK_HUMANOID_ROLES) {
  const result = {};
  for (const [role, aliases] of Object.entries(roles)) {
    result[role] = findBoneName(names, aliases);
  }
  return result;
}

export function missingHumanoidRoles(
  names,
  requiredRoles = SIDEKICK_REQUIRED_ROLES,
  roles = SIDEKICK_HUMANOID_ROLES,
) {
  const resolved = resolveHumanoidRig(names, roles);
  return requiredRoles.filter(role => !resolved[role]);
}

export function assertHumanoidRig(
  names,
  requiredRoles = SIDEKICK_REQUIRED_ROLES,
  roles = SIDEKICK_HUMANOID_ROLES,
) {
  const missing = missingHumanoidRoles(names, requiredRoles, roles);
  if (missing.length) {
    throw new Error(`Character rig is missing humanoid roles: ${missing.join(', ')}`);
  }
  return resolveHumanoidRig(names, roles);
}

export function diffRigJointNames(names, expected) {
  const actual = new Set(names);
  const wanted = new Set(expected);
  return {
    missing: expected.filter(name => !actual.has(name)),
    extra: [...actual].filter(name => !wanted.has(name)),
  };
}

export function assertRigJointNames(names, expected) {
  const { missing } = diffRigJointNames(names, expected);
  if (missing.length) {
    throw new Error(`Character rig is missing required joints: ${missing.join(', ')}`);
  }
}

export function collectNamedBones(root) {
  const bones = {};
  root.traverse(object => {
    if (object.isBone && object.name) bones[object.name] = object;
  });
  return bones;
}

export function scaleForTargetHeight(measuredHeight, targetHeight) {
  if (!(measuredHeight > 0) || !(targetHeight > 0)) {
    throw new RangeError('Character heights must be positive');
  }
  return targetHeight / measuredHeight;
}
