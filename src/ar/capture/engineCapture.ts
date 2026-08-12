import type {
  CameraPipelineModule,
  MediaRecorderCallbacks,
  XR8,
} from '../engine/engineTypes';
import {CAPTURE_VIDEO_MAX_DURATION_MS, CaptureError} from './captureTypes';
import {jpegBase64ToBlob} from './captureMedia';

const PHOTO_MAX_DIMENSION = 1280;
const PHOTO_JPEG_COMPRESSION = 75;
const VIDEO_MAX_DIMENSION = 720;

export interface EngineCaptureSession {
  destroy(): void;
  modules: CameraPipelineModule[];
  startVideo(callbacks: MediaRecorderCallbacks): void;
  stopVideo(): void;
  takePhoto(): Promise<Blob>;
}

/**
 * Wraps the official XR8 capture modules without leaking Engine concerns into UI.
 * Sources consulted 2026-08-11:
 * https://8thwall.org/docs/api/engine/canvasscreenshot
 * https://8thwall.org/docs/api/engine/mediarecorder
 */
export function createEngineCaptureSession(xr8: XR8): EngineCaptureSession {
  let destroyed = false;
  let recording = false;
  let stopRequested = false;

  xr8.CanvasScreenshot.configure({
    jpgCompression: PHOTO_JPEG_COMPRESSION,
    maxDimension: PHOTO_MAX_DIMENSION,
  });
  xr8.MediaRecorder.configure({
    enableEndCard: false,
    maxDimension: VIDEO_MAX_DIMENSION,
    maxDurationMs: CAPTURE_VIDEO_MAX_DURATION_MS,
    requestMic: xr8.MediaRecorder.RequestMicOptions.MANUAL,
  });

  return {
    modules: [
      xr8.CanvasScreenshot.pipelineModule(),
      xr8.MediaRecorder.pipelineModule(),
    ],

    async takePhoto(): Promise<Blob> {
      assertAvailable(destroyed);

      try {
        return jpegBase64ToBlob(await xr8.CanvasScreenshot.takeScreenshot());
      } catch (error: unknown) {
        if (error instanceof CaptureError) {
          throw error;
        }

        throw new CaptureError('PHOTO_CAPTURE_FAILED', 'Não foi possível tirar a foto.', {
          cause: error,
        });
      }
    },

    startVideo(callbacks): void {
      assertAvailable(destroyed);

      if (recording) {
        throw new CaptureError(
          'VIDEO_RECORDING_FAILED',
          'Já existe uma gravação em andamento.',
        );
      }

      recording = true;
      stopRequested = false;
      try {
        xr8.MediaRecorder.recordVideo({
          ...callbacks,
          onError: (error) => {
            recording = false;
            stopRequested = false;
            callbacks.onError?.(error);
          },
          onStop: () => {
            recording = false;
            stopRequested = false;
            callbacks.onStop?.();
          },
        });
      } catch (error: unknown) {
        recording = false;
        stopRequested = false;
        throw error;
      }
    },

    stopVideo(): void {
      if (!destroyed && recording && !stopRequested) {
        stopRequested = true;
        xr8.MediaRecorder.stopRecording();
      }
    },

    destroy(): void {
      if (destroyed) {
        return;
      }

      if (recording && !stopRequested) {
        stopRequested = true;
        xr8.MediaRecorder.stopRecording();
      }

      recording = false;
      stopRequested = false;
      destroyed = true;
    },
  };
}

function assertAvailable(destroyed: boolean): void {
  if (destroyed) {
    throw new CaptureError(
      'CAPTURE_UNAVAILABLE',
      'A captura não está disponível nesta sessão.',
    );
  }
}
