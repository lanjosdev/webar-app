import {Group, Object3D, PerspectiveCamera, Quaternion, Vector3} from 'three';
import {describe, expect, it} from 'vitest';

import {applyGroundPlacementTransform} from './coordinates';

describe('applyGroundPlacementTransform', () => {
  it('applies the floating offset in world space under a translated parent', () => {
    const parent = new Group();
    parent.position.set(1, 0, 1);
    const target = new Object3D();
    const camera = new PerspectiveCamera();
    parent.add(target);
    parent.updateMatrixWorld(true);

    applyGroundPlacementTransform({
      camera,
      faceCameraYaw: false,
      groundOffset: 0.15,
      target,
      worldPoint: new Vector3(4, 0, -2),
    });

    expect(target.getWorldPosition(new Vector3()).toArray()).toEqual([4, 0.15, -2]);
  });

  it('faces local +Z toward the camera using yaw only', () => {
    const parent = new Group();
    const target = new Object3D();
    const camera = new PerspectiveCamera();
    parent.add(target);
    camera.position.set(5, 2, 0);
    camera.updateMatrixWorld(true);

    applyGroundPlacementTransform({
      camera,
      faceCameraYaw: true,
      groundOffset: 0.15,
      target,
      worldPoint: new Vector3(0, 0, 0),
    });

    const worldQuaternion = target.getWorldQuaternion(new Quaternion());
    const forward = new Vector3(0, 0, 1).applyQuaternion(worldQuaternion);
    const expectedDirection = new Vector3(1, 0, 0);

    expect(forward.dot(expectedDirection)).toBeCloseTo(1);
    expect(forward.y).toBeCloseTo(0);
    expect(target.getWorldPosition(new Vector3()).y).toBeCloseTo(0.15);
  });
});
