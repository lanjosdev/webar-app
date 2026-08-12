import {
  pauseAR,
  prepareARCapture,
  recenterAR,
  resumeAR,
  setARInteractionLocked,
  startAR,
  stopAR,
} from './ar/engine/init8thWall';
import {toARError} from './ar/engine/arError';
import {
  needsExplicitMotionPermission,
  requestMotionPermission,
} from './ar/engine/motionPermission';
import {TrackingState} from './ar/tracking/trackingState';
import {createCaptureUI} from './ui/capture';
import {createMotionPermissionUI} from './ui/motionPermission';
import {createStatusUI} from './ui/status';

const canvas = getCanvas('camera-feed');
const placementReticle = getElement('placement-reticle');
const trackingState = new TrackingState();
const diagnostics = new URLSearchParams(window.location.search).get('diagnostics') === '1'
  ? await import('./diagnostics/diagnostics').then(({createDiagnostics}) =>
      createDiagnostics(trackingState))
  : undefined;
const statusUI = createStatusUI(trackingState);
const motionPermissionUI = createMotionPermissionUI();
const captureUI = createCaptureUI({
  diagnostics,
  pauseAR,
  prepareCapture: prepareARCapture,
  resumeAR,
  setInteractionLocked: setARInteractionLocked,
  trackingState,
});
let destroyed = false;

statusUI.onStart(() => {
  diagnostics?.mark('start-intent');
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
  void startAR(canvas, trackingState, placementReticle, diagnostics).catch((error: unknown) => {
    handleStartError(error);
  });
}

function runAR(): Promise<void> {
  return startAR(canvas, trackingState, placementReticle, diagnostics);
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
  diagnostics?.recordError('ar', arError);
  trackingState.fail(arError);
}

statusUI.onRecenter(() => recenterAR());

const handleVisibilityChange = (): void => {
  if (document.visibilityState === 'hidden') {
    captureUI.handleInterruption('hidden');
    pauseAR();
  } else if (!captureUI.shouldKeepARPaused()) {
    resumeAR();
  }
};

const handlePageHide = (event: PageTransitionEvent): void => {
  captureUI.handleInterruption('pagehide');
  if (event.persisted) {
    pauseAR();
    return;
  }

  cleanup();
};

const handlePageShow = (): void => {
  if (
    !destroyed &&
    document.visibilityState === 'visible' &&
    !captureUI.shouldKeepARPaused()
  ) {
    resumeAR();
  }
};

const cleanup = (): void => {
  if (destroyed) {
    return;
  }

  destroyed = true;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('pagehide', handlePageHide);
  window.removeEventListener('pageshow', handlePageShow);
  captureUI.destroy();
  motionPermissionUI.destroy();
  statusUI.destroy();
  diagnostics?.destroy();
  stopAR();
};

document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('pagehide', handlePageHide);
window.addEventListener('pageshow', handlePageShow);

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
