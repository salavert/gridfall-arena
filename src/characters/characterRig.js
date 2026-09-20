export const UBC_JOINTS = Object.freeze([
  "root",
  "pelvis",
  "spine_01",
  "spine_02",
  "spine_03",
  "neck_01",
  "Head",
  "clavicle_l",
  "upperarm_l",
  "lowerarm_l",
  "hand_l",
  "index_01_l",
  "index_02_l",
  "index_03_l",
  "index_04_leaf_l",
  "middle_01_l",
  "middle_02_l",
  "middle_03_l",
  "middle_04_leaf_l",
  "pinky_01_l",
  "pinky_02_l",
  "pinky_03_l",
  "pinky_04_leaf_l",
  "ring_01_l",
  "ring_02_l",
  "ring_03_l",
  "ring_04_leaf_l",
  "thumb_01_l",
  "thumb_02_l",
  "thumb_03_l",
  "thumb_04_leaf_l",
  "clavicle_r",
  "upperarm_r",
  "lowerarm_r",
  "hand_r",
  "index_01_r",
  "index_02_r",
  "index_03_r",
  "index_04_leaf_r",
  "middle_01_r",
  "middle_02_r",
  "middle_03_r",
  "middle_04_leaf_r",
  "pinky_01_r",
  "pinky_02_r",
  "pinky_03_r",
  "pinky_04_leaf_r",
  "ring_01_r",
  "ring_02_r",
  "ring_03_r",
  "ring_04_leaf_r",
  "thumb_01_r",
  "thumb_02_r",
  "thumb_03_r",
  "thumb_04_leaf_r",
  "thigh_l",
  "calf_l",
  "foot_l",
  "ball_l",
  "ball_leaf_l",
  "thigh_r",
  "calf_r",
  "foot_r",
  "ball_r",
  "ball_leaf_r"
]);

export const UBC_SOCKETS = Object.freeze({
  head: 'Head',
  leftHand: 'hand_l',
  rightHand: 'hand_r',
  leftFoot: 'foot_l',
  rightFoot: 'foot_r',
});

export function diffRigJointNames(names, expected = UBC_JOINTS) {
  const actual = new Set(names);
  const wanted = new Set(expected);
  return {
    missing: expected.filter(name => !actual.has(name)),
    extra: [...actual].filter(name => !wanted.has(name)),
  };
}

export function assertRigJointNames(names, expected = UBC_JOINTS) {
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
