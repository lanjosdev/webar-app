import type {TrackingState} from '../tracking/trackingState';
import {createTrackingRecoveryController} from '../tracking/trackingRecovery';
import {createMinimalScene} from '../three/scene';
import {
  createGroundPlacementController,
  type GroundPlacementController,
} from '../world/placement';
import {ARError, toARError} from './arError';
import type {CameraPipelineModule, XR8} from './engineTypes';
import {createFullWindowCanvasModule} from './fullWindowCanvas';

export interface PipelineSession {
  modules: CameraPipelineModule[];
  pause(): void;
  recenter(): boolean;
  resume(): void;
}

export function createPipelineSession(
  xr8: XR8,
  trackingState: TrackingState,
  placementReticle: HTMLElement,
  onFatalError: (error: ARError) => void,
): PipelineSession {
  let disposeScene: (() => void) | undefined;
  let placementController: GroundPlacementController | undefined;
  let fatalErrorReported = false;
  let paused = false;
  const trackingRecovery = createTrackingRecoveryController(trackingState);

  const reportFatalError = (error: ARError): void => {
    if (fatalErrorReported) {
      return;
    }

    fatalErrorReported = true;
    placementController?.setEnabled(false);
    onFatalError(error);
  };

  const pause = (): void => {
    if (fatalErrorReported || paused) {
      return;
    }

    paused = true;
    placementController?.setEnabled(false);
    trackingRecovery.beginPaused();
  };

  const resume = (): void => {
    if (fatalErrorReported || !paused) {
      return;
    }

    paused = false;
    placementController?.setEnabled(false);
    trackingRecovery.beginResuming();
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
      }
    },

    onStart: ({canvas}) => {
      if (fatalErrorReported) {
        return;
      }

      const xrScene = xr8.Threejs.xrScene();
      const content = createMinimalScene(xrScene);
      placementController = createGroundPlacementController({
        canvas,
        onPlaced: () => trackingState.markObjectPlaced(),
        reticleElement: placementReticle,
        scene: xrScene.scene,
        target: content.placementTarget,
        targetBaseOffset: content.placementTargetBaseOffset,
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
    },

    onUpdate: ({processCpuResult}) => {
      if (fatalErrorReported || paused) {
        placementController?.setEnabled(false);
        return;
      }

      const reality = processCpuResult?.reality;
      const placementEnabled = trackingRecovery.update(reality);
      placementController?.setEnabled(placementEnabled);
    },

    onException: (error) => {
      placementController?.setEnabled(false);
      const arError = toARError(error, 'TRACKING_INITIALIZATION_ERROR');
      console.error('[WebAR] XR8 pipeline error', error);
      reportFatalError(arError);
    },

    onPaused: pause,

    onResume: resume,

    onDetach: () => {
      disposeScene?.();
      disposeScene = undefined;
    },
  };

  const modules = [
    createFullWindowCanvasModule(),
    xr8.GlTextureRenderer.pipelineModule(),
    xr8.Threejs.pipelineModule(),
    xr8.XrController.pipelineModule(),
    applicationModule,
  ];

  return {
    modules,
    pause,

    recenter(): boolean {
      const controller = placementController;

      if (fatalErrorReported || paused || !controller || !trackingRecovery.canRecenter()) {
        return false;
      }

      controller.setEnabled(false);

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
  };
}
