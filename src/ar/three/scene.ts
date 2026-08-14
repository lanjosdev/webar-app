import {
  DirectionalLight,
  Group,
  HemisphereLight,
  PMREMGenerator,
  type Object3D,
} from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

import type {XRThreeScene} from '../engine/engineTypes';
import type {PlacementModel} from './model';

const ENVIRONMENT_MAP_SIZE = 128;

export interface SceneContent {
  dispose(): void;
  placementTarget: Object3D;
}

export function createARScene(
  {camera, renderer, scene}: XRThreeScene,
  placementModel: PlacementModel,
): SceneContent {
  const content = new Group();
  content.name = 'webar-poc-content';

  // MeshStandardMaterial needs image-based lighting for metallic surfaces.
  // RoomEnvironment is converted to a compact PMREM once at startup; it lights
  // the model without replacing the transparent AR camera background.
  const roomEnvironment = new RoomEnvironment();
  const pmremGenerator = new PMREMGenerator(renderer);
  const environmentTarget = pmremGenerator.fromScene(
    roomEnvironment,
    0.04,
    0.1,
    100,
    {size: ENVIRONMENT_MAP_SIZE},
  );
  const previousEnvironment = scene.environment;
  const previousEnvironmentIntensity = scene.environmentIntensity;
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.38;
  roomEnvironment.dispose();
  pmremGenerator.dispose();

  const hemisphereLight = new HemisphereLight(0xffffff, 0x14243a, 0.72);
  const keyLight = new DirectionalLight(0xffffff, 0.98);
  keyLight.position.set(1.5, 3, 1.5);

  content.add(placementModel.root, hemisphereLight, keyLight);
  scene.add(content);

  const previousOnBeforeRender = scene.onBeforeRender;
  const handleBeforeRender: typeof scene.onBeforeRender = (...args) => {
    previousOnBeforeRender.call(scene, ...args);
    placementModel.rotation.update();
  };
  scene.onBeforeRender = handleBeforeRender;

  // World Tracking estimates one horizontal ground plane at Y = 0. The
  // placement controller offsets the normalized model above that virtual
  // plane; this is not multi-plane surface detection.
  camera.position.set(0, 1.6, 0);

  let disposed = false;

  return {
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      if (scene.onBeforeRender === handleBeforeRender) {
        scene.onBeforeRender = previousOnBeforeRender;
      }
      if (scene.environment === environmentTarget.texture) {
        scene.environment = previousEnvironment;
        scene.environmentIntensity = previousEnvironmentIntensity;
      }
      environmentTarget.dispose();
      scene.remove(content);
      placementModel.dispose();
    },
    placementTarget: placementModel.root,
  };
}
