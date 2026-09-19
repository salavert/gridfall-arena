import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

class HalfResolutionGTAOPass extends GTAOPass {
  setSize(width, height) {
    super.setSize(Math.max(1, Math.ceil(width * 0.5)), Math.max(1, Math.ceil(height * 0.5)));
  }
}

export class GameRenderer {
  constructor(canvas, scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.setClearColor(0x080a18, 1);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.gtao = new HalfResolutionGTAOPass(scene, camera, innerWidth / 2, innerHeight / 2);
    this.gtao.updateGtaoMaterial({ radius: 0.72, distanceExponent: 1.5, thickness: 1.3, distanceFallOff: 1.1, samples: 8 });
    this.gtao.updatePdMaterial({ rings: 2, samples: 8, radius: 5, lumaPhi: 8, depthPhi: 2.5, normalPhi: 3 });
    this.gtao.blendIntensity = 0.72;
    this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.55, 1.05);
    this.composer.addPass(this.bloom);
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);
    this.composer.addPass(new OutputPass());

    this.renderScale = Math.min(devicePixelRatio, 1.35);
    this.minScale = 0.72;
    this.maxScale = Math.min(devicePixelRatio, 1.45);
    this.frameSamples = [];
    this.adaptTimer = 0;
    this.shadowTimer = 0;
    this.shadowDirty = true;
    this.resize();
  }

  resize() {
    const width = innerWidth;
    const height = innerHeight;
    if (this.width === width && this.height === height && this.appliedScale === this.renderScale) return;
    this.width = width;
    this.height = height;
    this.appliedScale = this.renderScale;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.renderScale);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(this.renderScale);
    this.composer.setSize(width, height);
    this.fxaa.material.uniforms.resolution.value.set(1 / (width * this.renderScale), 1 / (height * this.renderScale));
    this.shadowDirty = true;
  }

  markShadowsDirty() {
    this.shadowDirty = true;
  }

  adapt(dt) {
    if (document.hidden || dt > 0.2) return;
    this.frameSamples.push(dt);
    if (this.frameSamples.length > 180) this.frameSamples.shift();
    this.adaptTimer += dt;
    if (this.adaptTimer < 2.5 || this.frameSamples.length < 90) return;
    this.adaptTimer = 0;
    const sorted = [...this.frameSamples].sort((a, b) => a - b);
    const p80 = sorted[Math.floor(sorted.length * 0.8)];
    const previous = this.renderScale;
    if (p80 > 1 / 52) this.renderScale = Math.max(this.minScale, this.renderScale - 0.08);
    else if (p80 < 1 / 66) this.renderScale = Math.min(this.maxScale, this.renderScale + 0.04);
    if (Math.abs(previous - this.renderScale) > 0.001) this.resize();
  }

  render(dt) {
    this.resize();
    this.adapt(dt);
    this.shadowTimer += dt;
    if (this.shadowDirty && this.shadowTimer >= 1 / 12) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowDirty = false;
      this.shadowTimer = 0;
    }
    this.composer.render(dt);
  }
}
