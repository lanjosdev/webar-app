import {recenterAR, startAR, stopAR} from './ar/engine/init8thWall';
import {toARError} from './ar/engine/arError';
import {
  needsExplicitMotionPermission,
  requestMotionPermission,
} from './ar/engine/motionPermission';
import {TrackingState} from './ar/tracking/trackingState';
import {createMotionPermissionUI} from './ui/motionPermission';
import {createStatusUI} from './ui/status';

const canvas = getCanvas('camera-feed');
const placementReticle = getElement('placement-reticle');
const trackingState = new TrackingState();
const statusUI = createStatusUI(trackingState);
const motionPermissionUI = createMotionPermissionUI();

statusUI.onStart(() => {
  if (needsExplicitMotionPermission()) {
    motionPermissionUI.show();
    return;
  }

  beginAR();
});

motionPermissionUI.onConfirm(async () => {
  prepareStartAttempt();
  trackingState.setPhase('requesting-motion');

  try {
    await requestMotionPermission();
    motionPermissionUI.hide(false);
    await runAR();
  } catch (error: unknown) {
    motionPermissionUI.hide(false);
    handleStartError(error);
  }
});

function beginAR(): void {
  prepareStartAttempt();
  void startAR(canvas, trackingState, placementReticle).catch((error: unknown) => {
    handleStartError(error);
  });
}

function runAR(): Promise<void> {
  return startAR(canvas, trackingState, placementReticle);
}

function prepareStartAttempt(): void {
  if (trackingState.current.phase !== 'error') {
    return;
  }

  stopAR();
  trackingState.reset();
}

function handleStartError(error: unknown): void {
  const arError = toARError(error);
  console.error('[WebAR] Failed to start the experience.', error);
  trackingState.fail(arError);
}

statusUI.onRecenter(() => recenterAR());

const cleanup = (): void => {
  motionPermissionUI.destroy();
  statusUI.destroy();
  stopAR();
};

window.addEventListener('pagehide', cleanup, {once: true});

if (import.meta.hot) {
  import.meta.hot.dispose(cleanup);
}

function getCanvas(id: string): HTMLCanvasElement {
  const element = document.getElementById(id);

  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(`Required canvas #${id} was not found.`);
  }

  return element;
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Required element #${id} was not found.`);
  }

  return element;
}
