import {
  BoxGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
} from 'three';

import type {XRThreeScene} from '../engine/engineTypes';

const TRACKING_CUBE_SIZE = 0.35;
const TRACKING_CUBE_DISTANCE = 2;

export interface SceneContent {
  dispose(): void;
  placementTarget: Mesh;
  placementTargetBaseOffset: number;
}

export function createMinimalScene({camera, scene}: XRThreeScene): SceneContent {
  const content = new Group();
  content.name = 'webar-poc-content';

  const geometry = new BoxGeometry(
    TRACKING_CUBE_SIZE,
    TRACKING_CUBE_SIZE,
    TRACKING_CUBE_SIZE,
  );
  const material = new MeshStandardMaterial({color: 0x35d0ba, roughness: 0.55});
  const cube = new Mesh(geometry, material);
  cube.name = 'tracking-test-cube';
  cube.position.set(0, TRACKING_CUBE_SIZE / 2, -TRACKING_CUBE_DISTANCE);
  cube.visible = false;

  const hemisphereLight = new HemisphereLight(0xffffff, 0x14243a, 1.8);
  const keyLight = new DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(1.5, 3, 1.5);

  content.add(cube, hemisphereLight, keyLight);
  scene.add(content);

  // World Tracking estimates one horizontal ground plane at Y = 0. The
  // placement controller keeps the cube's base on that virtual plane; this is
  // not multi-plane surface detection.
  camera.position.set(0, 1.6, 0);

  return {
    dispose(): void {
      scene.remove(content);
      geometry.dispose();
      material.dispose();
    },
    placementTarget: cube,
    placementTargetBaseOffset: TRACKING_CUBE_SIZE / 2,
  };
}
