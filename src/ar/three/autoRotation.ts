import type {Object3D} from 'three';

export const AUTO_ROTATION_PERIOD_SECONDS = 15;
export const AUTO_ROTATION_SPEED_RADIANS_PER_SECOND =
  (Math.PI * 2) / AUTO_ROTATION_PERIOD_SECONDS;

const MAX_DELTA_SECONDS = 0.1;
const FULL_TURN = Math.PI * 2;

export interface MotionPreference {
  readonly matches: boolean;
  addChangeListener(listener: (matches: boolean) => void): void;
  removeChangeListener(listener: (matches: boolean) => void): void;
}

export interface AutoRotationController {
  dispose(): void;
  onPlaced(now?: number): void;
  reset(): void;
  setEnabled(enabled: boolean, now?: number): void;
  update(now?: number): void;
}

export function createAutoRotationController(
  target: Object3D,
  motionPreference = getMotionPreference(),
): AutoRotationController {
  let disposed = false;
  let enabled = false;
  let hasPlacement = false;
  let lastUpdateAt: number | undefined;
  let reducedMotion = motionPreference?.matches ?? false;

  const canRotate = (): boolean =>
    !disposed && enabled && hasPlacement && !reducedMotion;

  const handleMotionPreferenceChange = (matches: boolean): void => {
    reducedMotion = matches;
    lastUpdateAt = undefined;
  };

  motionPreference?.addChangeListener(handleMotionPreferenceChange);

  return {
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      lastUpdateAt = undefined;
      motionPreference?.removeChangeListener(handleMotionPreferenceChange);
    },

    onPlaced(now = performance.now()): void {
      target.rotation.y = 0;
      target.updateMatrixWorld(true);
      hasPlacement = true;
      lastUpdateAt = canRotate() ? now : undefined;
    },

    reset(): void {
      hasPlacement = false;
      lastUpdateAt = undefined;
      target.rotation.y = 0;
      target.updateMatrixWorld(true);
    },

    setEnabled(nextEnabled, now = performance.now()): void {
      if (enabled === nextEnabled || disposed) {
        return;
      }

      enabled = nextEnabled;
      lastUpdateAt = canRotate() ? now : undefined;
    },

    update(now = performance.now()): void {
      if (!canRotate()) {
        lastUpdateAt = undefined;
        return;
      }

      if (lastUpdateAt === undefined) {
        lastUpdateAt = now;
        return;
      }

      const deltaSeconds = Math.min(
        MAX_DELTA_SECONDS,
        Math.max(0, (now - lastUpdateAt) / 1000),
      );
      lastUpdateAt = now;

      if (deltaSeconds === 0) {
        return;
      }

      // Negative Y produces clockwise motion when the logo is viewed from
      // above. Keep the angle bounded without allocating per frame.
      target.rotation.y = (
        target.rotation.y - AUTO_ROTATION_SPEED_RADIANS_PER_SECOND * deltaSeconds
      ) % FULL_TURN;
      target.updateMatrixWorld(true);
    },
  };
}

function getMotionPreference(): MotionPreference | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return undefined;
  }

  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new Map<
    (matches: boolean) => void,
    (event: MediaQueryListEvent) => void
  >();

  return {
    get matches(): boolean {
      return query.matches;
    },
    addChangeListener(listener): void {
      const mediaListener = (event: MediaQueryListEvent): void => {
        listener(event.matches);
      };
      listeners.set(listener, mediaListener);
      query.addEventListener('change', mediaListener);
    },
    removeChangeListener(listener): void {
      const mediaListener = listeners.get(listener);
      if (!mediaListener) {
        return;
      }

      listeners.delete(listener);
      query.removeEventListener('change', mediaListener);
    },
  };
}
