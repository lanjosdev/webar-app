import {Object3D, Vector3} from 'three';
import {describe, expect, it, vi} from 'vitest';

import {
  AUTO_ROTATION_SPEED_RADIANS_PER_SECOND,
  createAutoRotationController,
  type MotionPreference,
} from './autoRotation';

describe('createAutoRotationController', () => {
  it('rotates clockwise using frame-independent delta only after placement', () => {
    const target = new Object3D();
    const controller = createAutoRotationController(target);

    controller.setEnabled(true, 0);
    controller.update(100);
    expect(target.rotation.y).toBe(0);

    controller.onPlaced(100);
    controller.update(200);
    expect(target.rotation.y).toBeCloseTo(
      -AUTO_ROTATION_SPEED_RADIANS_PER_SECOND * 0.1,
    );

    controller.dispose();
  });

  it('pauses without an angular jump and restarts from the front on placement', () => {
    const target = new Object3D();
    const controller = createAutoRotationController(target);
    controller.setEnabled(true, 0);
    controller.onPlaced(0);
    controller.update(100);
    const angleBeforePause = target.rotation.y;

    controller.setEnabled(false, 100);
    controller.update(5_000);
    expect(target.rotation.y).toBe(angleBeforePause);

    controller.setEnabled(true, 5_000);
    controller.update(5_100);
    expect(target.rotation.y).toBeCloseTo(
      angleBeforePause - AUTO_ROTATION_SPEED_RADIANS_PER_SECOND * 0.1,
    );

    controller.onPlaced(5_100);
    expect(target.rotation.y).toBe(0);

    controller.dispose();
  });

  it('caps long frame deltas to avoid visible jumps', () => {
    const target = new Object3D();
    const controller = createAutoRotationController(target);
    controller.setEnabled(true, 0);
    controller.onPlaced(0);

    controller.update(2_000);

    expect(target.rotation.y).toBeCloseTo(
      -AUTO_ROTATION_SPEED_RADIANS_PER_SECOND * 0.1,
    );
    controller.dispose();
  });

  it('reacts to reduced-motion changes and removes its listener on dispose', () => {
    const target = new Object3D();
    const preference = createMotionPreference(false);
    const controller = createAutoRotationController(target, preference.value);
    controller.setEnabled(true, 0);
    controller.onPlaced(0);
    controller.update(100);
    const animatedAngle = target.rotation.y;

    preference.emit(true);
    controller.update(200);
    expect(target.rotation.y).toBe(animatedAngle);

    preference.emit(false);
    controller.update(300);
    controller.update(400);
    expect(target.rotation.y).toBeLessThan(animatedAngle);

    controller.dispose();
    expect(preference.remove).toHaveBeenCalledOnce();
  });

  it('resets rotation and placement state', () => {
    const target = new Object3D();
    const controller = createAutoRotationController(target);
    controller.setEnabled(true, 0);
    controller.onPlaced(0);
    controller.update(100);

    controller.reset();
    controller.update(200);

    expect(target.rotation.y).toBe(0);
    expect(target.getWorldDirection(new Vector3()).z).toBeCloseTo(1);
    controller.dispose();
  });
});

function createMotionPreference(initialMatches: boolean): {
  emit(matches: boolean): void;
  remove: ReturnType<typeof vi.fn>;
  value: MotionPreference;
} {
  let matches = initialMatches;
  const listeners = new Set<(matches: boolean) => void>();
  const remove = vi.fn((listener: (matches: boolean) => void) => {
    listeners.delete(listener);
  });

  return {
    emit(nextMatches): void {
      matches = nextMatches;
      listeners.forEach((listener) => listener(matches));
    },
    remove,
    value: {
      get matches(): boolean {
        return matches;
      },
      addChangeListener(listener): void {
        listeners.add(listener);
      },
      removeChangeListener: remove,
    },
  };
}
