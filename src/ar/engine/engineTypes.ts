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
  onPaused?: () => void;
  onResume?: () => void;
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

export interface MediaRecorderResult {
  videoBlob: Blob;
}

export interface MediaRecorderCallbacks {
  onError?: (error: unknown) => void;
  onFinalizeProgress?: (progress: {progress: number; total: number}) => void;
  onPreviewReady?: (result: MediaRecorderResult) => void;
  onStart?: () => void;
  onStop?: () => void;
  onVideoReady?: (result: MediaRecorderResult) => void;
}

export interface XR8 {
  CanvasScreenshot: {
    configure(options: {jpgCompression?: number; maxDimension?: number}): void;
    pipelineModule(): CameraPipelineModule;
    takeScreenshot(options?: {
      onProcessFrame?: (args: {ctx: CanvasRenderingContext2D}) => void;
    }): Promise<string>;
  };
  GlTextureRenderer: {
    pipelineModule(): CameraPipelineModule;
  };
  MediaRecorder: {
    RequestMicOptions: {
      AUTO: 'auto';
      MANUAL: 'manual';
    };
    configure(options: {
      enableEndCard?: boolean;
      maxDimension?: number;
      maxDurationMs?: number;
      requestMic?: 'auto' | 'manual';
    }): void;
    pipelineModule(): CameraPipelineModule;
    recordVideo(callbacks: MediaRecorderCallbacks): void;
    stopRecording(): void;
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
  isPaused(): boolean;
  loadChunk(name: 'slam'): Promise<void>;
  pause(): void;
  removeCameraPipelineModules(modules: CameraPipelineModule[]): void;
  resume(): void;
  run(options: {
    allowedDevices?: unknown;
    cameraConfig?: {direction: unknown};
    canvas: HTMLCanvasElement;
  }): void;
  stop(): void;
}
