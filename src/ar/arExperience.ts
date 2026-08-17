import {
  pauseAR,
  prepareARCapture,
  recenterAR,
  resumeAR,
  setARInteractionLocked,
  startAR,
  stopAR,
  whenAREngineReady,
} from './engine/init8thWall';
import {toARError} from './engine/arError';
import {TrackingState} from './tracking/trackingState';
import {createCaptureUI} from '../ui/capture';
import {createStatusUI} from '../ui/status';
import {
  normalizeModelAppearance,
  type ModelAppearanceConfig,
} from '../three/modelAppearance';

export interface ARExperience {
  destroy(): void;
  pause(reason?: 'hidden' | 'pagehide'): void;
  resume(): void;
  start(): void;
}

export interface CreateARExperienceOptions {
  appearance: ModelAppearanceConfig;
}

export async function createARExperience(
  options: CreateARExperienceOptions,
): Promise<ARExperience> {
  const canvas = getCanvas('camera-feed');
  const placementReticle = getElement('placement-reticle');
  const trackingState = new TrackingState();
  const appearance = Object.freeze(normalizeModelAppearance(options.appearance));
  const diagnostics =
    new URLSearchParams(window.location.search).get('diagnostics') === '1'
      ? await import('../diagnostics/diagnostics').then(({createDiagnostics}) =>
          createDiagnostics(trackingState),
        )
      : undefined;

  if (diagnostics) {
    void whenAREngineReady()
      .then(() => diagnostics.mark('engine-ready'))
      .catch((error: unknown) => diagnostics.recordError('ar', error));
  }

  const statusUI = createStatusUI(trackingState);
  const captureUI = createCaptureUI({
    diagnostics,
    pauseAR,
    prepareCapture: prepareARCapture,
    resumeAR,
    setInteractionLocked: setARInteractionLocked,
    trackingState,
  });
  let destroyed = false;

  const prepareStartAttempt = (): void => {
    if (trackingState.current.phase !== 'error') {
      return;
    }

    stopAR();
    trackingState.reset();
  };

  const handleStartError = (error: unknown): void => {
    const arError = toARError(error);
    console.error('[WebAR] Failed to start the experience.', error);
    diagnostics?.recordError('ar', arError);
    trackingState.fail(arError);
  };

  const beginAR = (): void => {
    if (destroyed) {
      return;
    }

    prepareStartAttempt();
    diagnostics?.mark('start-intent');
    void startAR(
      canvas,
      trackingState,
      placementReticle,
      diagnostics,
      appearance,
    ).catch(
      handleStartError,
    );
  };

  statusUI.onStart(beginAR);
  statusUI.onRecenter(() => recenterAR());

  return {
    start: beginAR,

    pause(reason = 'hidden'): void {
      if (destroyed) {
        return;
      }

      captureUI.handleInterruption(reason);
      pauseAR();
    },

    resume(): void {
      if (!destroyed) {
        resumeAR();
      }
    },

    destroy(): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      captureUI.destroy();
      statusUI.destroy();
      diagnostics?.destroy();
      stopAR();
    },
  };
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
