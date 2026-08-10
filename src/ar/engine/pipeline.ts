import type {TrackingState} from '../tracking/trackingState';
import {createMinimalScene} from '../three/scene';
import {ARError, toARError} from './arError';
import type {CameraPipelineModule, XR8} from './engineTypes';
import {createFullWindowCanvasModule} from './fullWindowCanvas';

export function createPipelineModules(
  xr8: XR8,
  trackingState: TrackingState,
): CameraPipelineModule[] {
  let disposeScene: (() => void) | undefined;

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

    onStart: () => {
      const xrScene = xr8.Threejs.xrScene();
      const content = createMinimalScene(xrScene);
      disposeScene = () => content.dispose();

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

      if (reality?.trackingStatus === 'NORMAL') {
        trackingState.setPhase('tracking-ready');
      } else if (reality?.trackingStatus === 'LIMITED') {
        const phase = reality.trackingReason === 'INITIALIZING'
          ? 'tracking-initializing'
          : 'tracking-limited';
        trackingState.setPhase(phase);
      }
    },

    onException: (error) => {
      const arError = toARError(error, 'TRACKING_INITIALIZATION_ERROR');
      console.error('[WebAR] XR8 pipeline error', error);
      trackingState.fail(arError);
    },

    onDetach: () => {
      disposeScene?.();
      disposeScene = undefined;
    },
  };

  return [
    createFullWindowCanvasModule(),
    xr8.GlTextureRenderer.pipelineModule(),
    xr8.Threejs.pipelineModule(),
    xr8.XrController.pipelineModule(),
    applicationModule,
  ];
}
