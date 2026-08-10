import {
  BoxGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
} from 'three';

import type {XRThreeScene} from '../engine/engineTypes';

export interface SceneContent {
  dispose(): void;
}

export function createMinimalScene({camera, scene}: XRThreeScene): SceneContent {
  const content = new Group();
  content.name = 'webar-poc-content';

  const geometry = new BoxGeometry(0.35, 0.35, 0.35);
  const material = new MeshStandardMaterial({color: 0x35d0ba, roughness: 0.55});
  const cube = new Mesh(geometry, material);
  cube.name = 'tracking-test-cube';
  cube.position.set(0, 1.45, -2);

  const hemisphereLight = new HemisphereLight(0xffffff, 0x14243a, 1.8);
  const keyLight = new DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(1.5, 3, 1.5);

  content.add(cube, hemisphereLight, keyLight);
  scene.add(content);

  // A fixed eye-height origin keeps the smoke-test cube initially visible.
  // It is not surface detection or placement.
  camera.position.set(0, 1.6, 0);

  return {
    dispose(): void {
      scene.remove(content);
      geometry.dispose();
      material.dispose();
    },
  };
}
