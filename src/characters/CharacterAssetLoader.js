import { AnimationMixer, Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { assertRigJointNames, collectNamedBones, scaleForTargetHeight } from './characterRig.js';

export class CharacterAssetLoader {
  constructor({ loader, logger = console } = {}) {
    this.loader = loader ?? new GLTFLoader();
    this.loader.setMeshoptDecoder?.(MeshoptDecoder);
    this.logger = logger;
    this.templates = new Map();
  }

  preload(url) {
    if (!url) return Promise.reject(new Error('Character asset URL is required'));
    let pending = this.templates.get(url);
    if (!pending) {
      pending = this.loader.loadAsync(url).catch(error => {
        this.templates.delete(url);
        throw error;
      });
      this.templates.set(url, pending);
    }
    return pending;
  }

  async instantiate(url, {
    requiredJoints,
    targetHeight,
    yaw = 0,
    castShadow = true,
  } = {}) {
    const template = await this.preload(url);
    const root = cloneSkeleton(template.scene);
    const bones = collectNamedBones(root);
    if (requiredJoints) assertRigJointNames(Object.keys(bones), requiredJoints);

    root.rotation.y = yaw;
    root.updateMatrixWorld(true);

    let measuredHeight = null;
    if (targetHeight) {
      const box = new Box3().setFromObject(root);
      const size = box.getSize(new Vector3());
      measuredHeight = size.y;
      root.scale.multiplyScalar(scaleForTargetHeight(measuredHeight, targetHeight));
      root.updateMatrixWorld(true);
    }

    const materials = new Set();
    root.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = castShadow;
      object.receiveShadow = false;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material) materials.add(material);
      }
    });

    const clips = new Map(template.animations.map(clip => [clip.name, clip]));
    const mixer = new AnimationMixer(root);

    return {
      root,
      bones,
      clips,
      mixer,
      materials,
      measuredHeight,
      stop() {
        mixer.stopAllAction();
        mixer.uncacheRoot(root);
      },
    };
  }
}
