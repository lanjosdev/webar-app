import {
  DirectionalLight,
  Group,
  HemisphereLight,
  type Object3D,
} from 'three';

import type {XRThreeScene} from '../engine/engineTypes';
import type {PlacementModel} from './model';

export interface SceneContent {
  dispose(): void;
  placementTarget: Object3D;
}

export function createARScene(
  {camera, scene}: XRThreeScene,
  placementModel: PlacementModel,
): SceneContent {
  const content = new Group();
  content.name = 'webar-poc-content';

  const hemisphereLight = new HemisphereLight(0xffffff, 0x14243a, 1.8);
  const keyLight = new DirectionalLight(0xffffff, 2.2);
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
      scene.remove(content);
      placementModel.dispose();
    },
    placementTarget: placementModel.root,
  };
}
