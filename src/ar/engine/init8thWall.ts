import {XR8Promise} from '@8thwall/engine-binary';
import * as THREE from 'three';

import type {TrackingState} from '../tracking/trackingState';
import {ARError, toARError} from './arError';
import type {CameraPipelineModule, XR8} from './engineTypes';
import {createPipelineSession, type PipelineSession} from './pipeline';

const ENGINE_LOAD_TIMEOUT_MS = 15_000;

let activeXR8: XR8 | undefined;
let activeModules: CameraPipelineModule[] = [];
let activeSession: PipelineSession | undefined;
let activeSessionToken: symbol | undefined;
let activeFatalErrorHandler: ((error: ARError) => void) | undefined;
let activeSessionFailed = false;
let activeRunStarted = false;
let pauseRequested = false;
let startPromise: Promise<void> | undefined;

export function startAR(
  canvas: HTMLCanvasElement,
  trackingState: TrackingState,
  placementReticle: HTMLElement,
): Promise<void> {
  startPromise ??= bootstrapAR(canvas, trackingState, placementReticle).catch((error: unknown) => {
    stopAR();
    throw toARError(error);
  });

  return startPromise;
}

export function stopAR(): void {
  const xr8 = activeXR8;
  const modules = activeModules;

  activeXR8 = undefined;
  activeModules = [];
  activeSession = undefined;
  activeSessionToken = undefined;
  activeFatalErrorHandler = undefined;
  activeSessionFailed = false;
  activeRunStarted = false;
  startPromise = undefined;

  if (!xr8) {
    return;
  }

  try {
    xr8.stop();
  } catch (error: unknown) {
    console.warn('[WebAR] Could not stop the XR8 session cleanly.', error);
  }

  if (modules.length > 0) {
    try {
      xr8.removeCameraPipelineModules(modules);
    } catch (error: unknown) {
      console.warn('[WebAR] Could not remove every XR8 pipeline module.', error);
    }
  }
}

/**
 * Pauses device motion and the camera session while the page is hidden.
 * Official APIs, consulted 2026-08-11:
 * https://8thwall.org/docs/api/engine/xr8/pause
 * https://8thwall.org/docs/api/engine/xr8/ispaused
 */
export function pauseAR(): void {
  pauseRequested = true;

  const xr8 = activeXR8;
  const session = activeSession;

  if (!xr8 || !session || !activeRunStarted || activeSessionFailed) {
    return;
  }

  try {
    session.pause();

    if (!xr8.isPaused()) {
      xr8.pause();
    }
  } catch (error: unknown) {
    reportLifecycleError('pausar', error);
  }
}

/**
 * Resumes a paused XR session. Placement remains blocked until tracking has
 * returned to NORMAL continuously for the recovery stability window.
 * Official API, consulted 2026-08-11:
 * https://8thwall.org/docs/api/engine/xr8/resume
 */
export function resumeAR(): void {
  pauseRequested = false;

  const xr8 = activeXR8;
  const session = activeSession;

  if (!xr8 || !session || !activeRunStarted || activeSessionFailed) {
    return;
  }

  try {
    session.resume();

    if (xr8.isPaused()) {
      xr8.resume();
    }
  } catch (error: unknown) {
    reportLifecycleError('retomar', error);
  }
}

export function recenterAR(): boolean {
  return activeSession?.recenter() ?? false;
}

async function bootstrapAR(
  canvas: HTMLCanvasElement,
  trackingState: TrackingState,
  placementReticle: HTMLElement,
): Promise<void> {
  const sessionToken = Symbol('webar-session');
  activeSessionToken = sessionToken;
  activeSessionFailed = false;
  activeFatalErrorHandler = (error): void => {
    if (activeSessionToken !== sessionToken || activeSessionFailed) {
      return;
    }

    activeSessionFailed = true;
    trackingState.fail(error);

    // Do not tear down XR8 from inside one of its own pipeline callbacks.
    // The token prevents a stale callback from stopping a newer retry session.
    queueMicrotask(() => {
      if (activeSessionToken === sessionToken) {
        stopAR();
      }
    });
  };

  assertBrowserPrerequisites();

  // XR8.Threejs uses the global Three.js namespace. Exposing the imported
  // namespace ensures both integrations share the same Three.js instance.
  window.THREE = THREE;

  trackingState.setPhase('loading-engine');
  const xr8 = await waitForEngine();
  activeXR8 = xr8;
  const allowedDevices = xr8.XrConfig.device().MOBILE;

  assertXR8DeviceCompatible(xr8, allowedDevices);

  trackingState.setPhase('loading-slam');
  try {
    await xr8.loadChunk('slam');
  } catch (error: unknown) {
    throw new ARError('SLAM_LOAD_ERROR', 'Falha ao carregar o componente de World Tracking.', {
      cause: error,
    });
  }

  // Official API, consulted 2026-08-07: World Tracking must be configured
  // before XrController.pipelineModule() and XR8.run().
  xr8.XrController.configure({
    disableWorldTracking: false,
    enableLighting: false,
    enableWorldPoints: false,
    scale: 'responsive',
  });

  const session = createPipelineSession(
    xr8,
    trackingState,
    placementReticle,
    activeFatalErrorHandler,
  );
  const {modules} = session;
  xr8.addCameraPipelineModules(modules);
  activeModules = modules;
  activeSession = session;

  trackingState.setPhase('requesting-camera');
  xr8.run({
    allowedDevices,
    cameraConfig: {direction: xr8.XrConfig.camera().BACK},
    canvas,
  });
  activeRunStarted = true;

  if (pauseRequested || document.visibilityState === 'hidden') {
    pauseAR();
  }
}

function reportLifecycleError(action: 'pausar' | 'retomar', error: unknown): void {
  console.error(`[WebAR] Failed to ${action} the XR8 session.`, error);
  activeFatalErrorHandler?.(
    new ARError(
      'SESSION_LIFECYCLE_ERROR',
      `Não foi possível ${action} a experiência. Toque em “Tentar novamente”.`,
      {cause: error},
    ),
  );
}

function assertXR8DeviceCompatible(xr8: XR8, allowedDevices: unknown): void {
  const options = {allowedDevices};

  if (xr8.XrDevice.isDeviceBrowserCompatible(options)) {
    return;
  }

  const reasons = xr8.XrDevice.incompatibleReasons(options);
  console.warn('[WebAR] Device is not compatible with mobile World Tracking.', reasons);

  throw new ARError(
    'UNSUPPORTED_DEVICE',
    'O World Tracking deve ser aberto em um celular compatível.',
    {cause: reasons},
  );
}

async function waitForEngine(): Promise<XR8> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new ARError(
          'ENGINE_LOAD_ERROR',
          'O 8th Wall Engine não carregou dentro do tempo esperado.',
        ),
      );
    }, ENGINE_LOAD_TIMEOUT_MS);
  });

  try {
    return await Promise.race([XR8Promise, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function assertBrowserPrerequisites(): void {
  const hasWebGL = Boolean(
    document.createElement('canvas').getContext('webgl2') ??
      document.createElement('canvas').getContext('webgl'),
  );

  if (!window.isSecureContext) {
    throw new ARError(
      'UNSUPPORTED_BROWSER',
      'A experiência precisa ser aberta em uma origem HTTPS segura.',
    );
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.WebAssembly || !hasWebGL) {
    throw new ARError(
      'UNSUPPORTED_BROWSER',
      'Este navegador não oferece todos os recursos necessários para WebAR.',
    );
  }
}
