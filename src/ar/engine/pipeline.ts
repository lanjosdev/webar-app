import type {TrackingState} from '../tracking/trackingState';
import type {DiagnosticsSink} from '../../diagnostics/diagnosticsTypes';
import {createTrackingRecoveryController} from '../tracking/trackingRecovery';
import {
  PLACEMENT_MODEL_GROUND_OFFSET,
  type PlacementModel,
} from '../three/model';
import {createARScene} from '../three/scene';
import {
  createGroundPlacementController,
  type GroundPlacementController,
} from '../world/placement';
import {ARError, toARError} from './arError';
import type {CameraPipelineModule, XR8} from './engineTypes';
import {createFullWindowCanvasModule} from './fullWindowCanvas';

export interface PipelineSession {
  dispose(): void;
  modules: CameraPipelineModule[];
  pause(): void;
  recenter(): boolean;
  resume(): void;
  setInteractionLocked(locked: boolean): void;
}

export function createPipelineSession(
  xr8: XR8,
  trackingState: TrackingState,
  placementReticle: HTMLElement,
  placementModel: PlacementModel,
  onFatalError: (error: ARError) => void,
  diagnostics?: DiagnosticsSink,
): PipelineSession {
  let disposeScene: (() => void) | undefined;
  let placementController: GroundPlacementController | undefined;
  let fatalErrorReported = false;
  let disposed = false;
  let interactionLocked = false;
  let paused = false;
  let placementAllowedByTracking = false;
  const trackingRecovery = createTrackingRecoveryController(trackingState);

  const dispose = (): void => {
    if (disposed) {
      return;
    }

    disposed = true;
    placementController?.dispose();
    placementController = undefined;
    disposeScene?.();
    disposeScene = undefined;
    placementModel.dispose();
  };

  const syncPlacementInteraction = (): void => {
    placementController?.setEnabled(
      placementAllowedByTracking && !interactionLocked && !fatalErrorReported && !paused,
    );
  };

  const reportFatalError = (error: ARError): void => {
    if (fatalErrorReported) {
      return;
    }

    fatalErrorReported = true;
    placementAllowedByTracking = false;
    syncPlacementInteraction();
    diagnostics?.recordError('ar', error);
    onFatalError(error);
  };

  const pause = (): void => {
    if (fatalErrorReported || paused) {
      return;
    }

    paused = true;
    placementAllowedByTracking = false;
    syncPlacementInteraction();
    trackingRecovery.beginPaused();
    diagnostics?.mark('ar-paused');
  };

  const resume = (): void => {
    if (fatalErrorReported || !paused) {
      return;
    }

    paused = false;
    placementAllowedByTracking = false;
    syncPlacementInteraction();
    trackingRecovery.beginResuming();
    diagnostics?.mark('ar-resumed');
  };

  const applicationModule: CameraPipelineModule = {
    name: 'webar-poc-lifecycle',

    onCameraStatusChange: ({status}) => {
      if (status === 'failed') {
        reportFatalError(
          new ARError(
            'CAMERA_UNAVAILABLE',
            'A câmera não pôde ser iniciada. Verifique as permissões do navegador.',
          ),
        );
      } else if (
        fatalErrorReported ||
        paused ||
        trackingState.current.phase === 'tracking-recovering'
      ) {
        return;
      } else if (status === 'requesting') {
        trackingState.setPhase('requesting-camera');
      } else if (status === 'hasStream' || status === 'hasVideo') {
        trackingState.setPhase('tracking-initializing');
        if (status === 'hasVideo') {
          diagnostics?.mark('camera-video');
        }
      }
    },

    onStart: ({canvas}) => {
      if (fatalErrorReported || disposed) {
        return;
      }

      const xrScene = xr8.Threejs.xrScene();
      const content = createARScene(xrScene, placementModel);
      placementController = createGroundPlacementController({
        canvas,
        faceTargetTowardCamera: true,
        onPlaced: () => trackingState.markObjectPlaced(),
        reticleElement: placementReticle,
        scene: xrScene.scene,
        target: content.placementTarget,
        targetGroundOffset: PLACEMENT_MODEL_GROUND_OFFSET,
      });
      disposeScene = () => {
        placementController?.dispose();
        placementController = undefined;
        content.dispose();
      };

      // Official API: synchronizes the controller origin and camera projection
      // with the scene created by XR8.Threejs.pipelineModule().
      xr8.XrController.updateCameraProjectionMatrix({
        facing: xrScene.camera.quaternion,
        origin: xrScene.camera.position,
      });

      trackingState.setPhase(paused ? 'paused' : 'tracking-initializing');
      diagnostics?.mark('pipeline-start');
    },

    onUpdate: ({processCpuResult}) => {
      if (fatalErrorReported || paused) {
        placementAllowedByTracking = false;
        syncPlacementInteraction();
        return;
      }

      diagnostics?.recordFrame();
      const reality = processCpuResult?.reality;
      placementAllowedByTracking = trackingRecovery.update(reality);
      syncPlacementInteraction();
    },

    onException: (error) => {
      placementAllowedByTracking = false;
      syncPlacementInteraction();
      const arError = toARError(error, 'TRACKING_INITIALIZATION_ERROR');
      console.error('[WebAR] XR8 pipeline error', error);
      reportFatalError(arError);
    },

    onPaused: pause,

    onResume: resume,

    onDetach: dispose,
  };

  const modules = [
    createFullWindowCanvasModule(),
    xr8.GlTextureRenderer.pipelineModule(),
    xr8.Threejs.pipelineModule(),
    xr8.XrController.pipelineModule(),
    applicationModule,
  ];

  return {
    dispose,
    modules,
    pause,

    recenter(): boolean {
      const controller = placementController;

      if (
        fatalErrorReported ||
        interactionLocked ||
        paused ||
        !controller ||
        !trackingRecovery.canRecenter()
      ) {
        return false;
      }

      controller.setEnabled(false);
      placementAllowedByTracking = false;

      try {
        xr8.XrController.recenter();
      } catch (error: unknown) {
        console.error('[WebAR] Could not recenter World Tracking.', error);
        reportFatalError(
          new ARError(
            'TRACKING_RECENTER_ERROR',
            'Não foi possível recentralizar o ambiente. Tente reiniciar a experiência.',
            {cause: error},
          ),
        );
        return true;
      }

      controller.reset();
      trackingRecovery.beginRecentering();
      return true;
    },

    resume,

    setInteractionLocked(locked): void {
      interactionLocked = locked;
      syncPlacementInteraction();
    },
  };
}
