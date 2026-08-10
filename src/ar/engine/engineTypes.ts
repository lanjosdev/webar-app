import type {Camera, Quaternion, Scene, Vector3, WebGLRenderer} from 'three';

export type CameraStatus = 'requesting' | 'hasStream' | 'hasVideo' | 'failed';
export type RealityTrackingStatus = 'LIMITED' | 'NORMAL';
export type RealityTrackingReason = 'INITIALIZING' | 'UNSPECIFIED';

export interface RealityResult {
  trackingReason?: RealityTrackingReason;
  trackingStatus?: RealityTrackingStatus;
}

export interface CameraPipelineModule {
  name: string;
  onAttach?: (args: {
    canvas: HTMLCanvasElement;
    orientation: number;
    videoHeight: number;
    videoWidth: number;
  }) => void;
  onCameraStatusChange?: (args: {
    status: CameraStatus;
    video?: HTMLVideoElement;
  }) => void;
  onCanvasSizeChange?: () => void;
  onDetach?: () => void;
  onDeviceOrientationChange?: (args: {orientation: number}) => void;
  onException?: (error: unknown) => void;
  onStart?: (args: {canvas: HTMLCanvasElement}) => void;
  onUpdate?: (args: {
    processCpuResult?: {
      reality?: RealityResult;
    };
  }) => void;
  onVideoSizeChange?: (args: {videoHeight: number; videoWidth: number}) => void;
}

export interface XRThreeScene {
  camera: Camera;
  renderer: WebGLRenderer;
  scene: Scene;
}

export interface XR8 {
  GlTextureRenderer: {
    pipelineModule(): CameraPipelineModule;
  };
  Threejs: {
    pipelineModule(): CameraPipelineModule;
    xrScene(): XRThreeScene;
  };
  XrConfig: {
    camera(): {
      BACK: unknown;
      FRONT: unknown;
    };
    device(): {
      ANY: unknown;
      MOBILE: unknown;
      MOBILE_AND_HEADSETS: unknown;
    };
  };
  XrController: {
    configure(options: {
      disableWorldTracking?: boolean;
      enableLighting?: boolean;
      enableWorldPoints?: boolean;
      scale?: 'absolute' | 'responsive';
    }): void;
    pipelineModule(): CameraPipelineModule;
    recenter(): void;
    updateCameraProjectionMatrix(options: {
      facing?: Pick<Quaternion, 'w' | 'x' | 'y' | 'z'>;
      origin?: Pick<Vector3, 'x' | 'y' | 'z'>;
    }): void;
  };
  XrDevice: {
    incompatibleReasons(options: {allowedDevices: unknown}): unknown[];
    isDeviceBrowserCompatible(options: {allowedDevices: unknown}): boolean;
  };
  addCameraPipelineModules(modules: CameraPipelineModule[]): void;
  loadChunk(name: 'slam'): Promise<void>;
  removeCameraPipelineModules(modules: CameraPipelineModule[]): void;
  run(options: {
    allowedDevices?: unknown;
    cameraConfig?: {direction: unknown};
    canvas: HTMLCanvasElement;
  }): void;
  stop(): void;
}
