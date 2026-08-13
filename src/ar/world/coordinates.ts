import {Quaternion, type Camera, type Object3D, Vector3} from 'three';

interface GroundPlacementTransformOptions {
  camera: Camera;
  faceCameraYaw: boolean;
  groundOffset: number;
  target: Object3D;
  worldPoint: Vector3;
}

const WORLD_UP = new Vector3(0, 1, 0);

export function applyGroundPlacementTransform({
  camera,
  faceCameraYaw,
  groundOffset,
  target,
  worldPoint,
}: GroundPlacementTransformOptions): void {
  target.position.copy(worldPoint);
  target.position.y += groundOffset;

  if (target.parent) {
    target.parent.updateWorldMatrix(true, false);
    target.parent.worldToLocal(target.position);
  }

  target.updateMatrixWorld(true);

  if (faceCameraYaw) {
    orientObjectTowardCameraYaw(target, camera);
  }

  target.updateMatrixWorld(true);
}

export function orientObjectTowardCameraYaw(
  target: Object3D,
  camera: Camera,
): void {
  const targetWorldPosition = target.getWorldPosition(new Vector3());
  const cameraWorldPosition = camera.getWorldPosition(new Vector3());
  const direction = cameraWorldPosition.sub(targetWorldPosition);
  direction.y = 0;

  if (direction.lengthSq() <= Number.EPSILON) {
    return;
  }

  direction.normalize();
  const yaw = Math.atan2(direction.x, direction.z);
  const desiredWorldQuaternion = new Quaternion().setFromAxisAngle(WORLD_UP, yaw);

  if (target.parent) {
    const parentWorldQuaternion = target.parent.getWorldQuaternion(new Quaternion());
    target.quaternion.copy(parentWorldQuaternion.invert().multiply(desiredWorldQuaternion));
  } else {
    target.quaternion.copy(desiredWorldQuaternion);
  }
}
