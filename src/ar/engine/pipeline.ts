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
  recenter(): boolean;
}

export function createPipelineSession(
  xr8: XR8,
  trackingState: TrackingState,
  placementReticle: HTMLElement,
): PipelineSession {
  let disposeScene: (() => void) | undefined;
  let placementController: GroundPlacementController | undefined;
  const trackingRecovery = createTrackingRecoveryController(trackingState);

  const applicationModule: CameraPipelineModule = {
    name: 'webar-poc-lifecycle',

    onCameraStatusChange: ({status}) => {
      if (status === 'requesting') {
        trackingState.setPhase('requesting-camera');
      } else if (status === 'hasStream' || status === 'hasVideo') {
        trackingState.setPhase('tracking-initializing');
      } else if (status === 'failed') {
        trackingState.fail(
          new ARError(
            'CAMERA_UNAVAILABLE',
            'A câmera não pôde ser iniciada. Verifique as permissões do navegador.',
          ),
        );
      }
    },

    onStart: ({canvas}) => {
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

      trackingState.setPhase('tracking-initializing');
    },

    onUpdate: ({processCpuResult}) => {
      const reality = processCpuResult?.reality;
      const placementEnabled = trackingRecovery.update(reality);
      placementController?.setEnabled(placementEnabled);
    },

    onException: (error) => {
      placementController?.setEnabled(false);
      const arError = toARError(error, 'TRACKING_INITIALIZATION_ERROR');
      console.error('[WebAR] XR8 pipeline error', error);
      trackingState.fail(arError);
    },

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

    recenter(): boolean {
      const controller = placementController;

      if (!controller || !trackingRecovery.canRecenter()) {
        return false;
      }

      controller.setEnabled(false);

      try {
        xr8.XrController.recenter();
      } catch (error: unknown) {
        console.error('[WebAR] Could not recenter World Tracking.', error);
        trackingState.fail(
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
  };
}
