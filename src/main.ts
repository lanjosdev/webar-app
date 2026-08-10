import {startAR, stopAR} from './ar/engine/init8thWall';
import {toARError} from './ar/engine/arError';
import {TrackingState} from './ar/tracking/trackingState';
import {createStatusUI} from './ui/status';

const canvas = getCanvas('camera-feed');
const placementReticle = getElement('placement-reticle');
const trackingState = new TrackingState();
const statusUI = createStatusUI(trackingState);

statusUI.onStart(() => {
  if (trackingState.current.phase === 'error') {
    stopAR();
    trackingState.reset();
  }

  void startAR(canvas, trackingState, placementReticle).catch((error: unknown) => {
    const arError = toARError(error);
    console.error('[WebAR] Failed to start the experience.', error);
    trackingState.fail(arError);
  });
});

const cleanup = (): void => {
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
