import type {PerspectiveCamera, Vector3} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export const SHOWROOM_MIN_DISTANCE = 1.4;
export const SHOWROOM_MAX_DISTANCE = 3.4;
export const SHOWROOM_MIN_POLAR_ANGLE = Math.PI * 0.3;
export const SHOWROOM_MAX_POLAR_ANGLE = Math.PI * 0.49;
export const SHOWROOM_DAMPING_FACTOR = 0.06;
export const SHOWROOM_AUTO_ROTATE_SPEED = 2.5;

export function createShowroomControls(
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  target: Vector3,
): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = SHOWROOM_DAMPING_FACTOR;
  controls.enablePan = false;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.minDistance = SHOWROOM_MIN_DISTANCE;
  controls.maxDistance = SHOWROOM_MAX_DISTANCE;
  controls.minPolarAngle = SHOWROOM_MIN_POLAR_ANGLE;
  controls.maxPolarAngle = SHOWROOM_MAX_POLAR_ANGLE;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.8;
  controls.autoRotateSpeed = SHOWROOM_AUTO_ROTATE_SPEED;
  controls.target.copy(target);
  controls.update();
  controls.saveState();

  return controls;
}
