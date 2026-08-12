export type CaptureKind = 'photo' | 'video';
export type CaptureMode = 'photo' | 'video';
export const CAPTURE_VIDEO_MAX_DURATION_MS = 10_000;

export type CapturePhase =
  | 'unavailable'
  | 'preparing'
  | 'ready'
  | 'capturing-photo'
  | 'recording'
  | 'finalizing'
  | 'preview'
  | 'sharing'
  | 'error';

export type CaptureErrorCode =
  | 'CAPTURE_UNAVAILABLE'
  | 'PHOTO_CAPTURE_FAILED'
  | 'VIDEO_RECORDING_FAILED'
  | 'VIDEO_FINALIZATION_FAILED'
  | 'SHARE_FAILED';

export class CaptureError extends Error {
  readonly code: CaptureErrorCode;

  constructor(code: CaptureErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CaptureError';
    this.code = code;
  }
}

export interface CaptureAsset {
  blob: Blob;
  bytes: number;
  createdAt: string;
  durationMs?: number;
  file: File;
  kind: CaptureKind;
  mimeType: string;
  objectUrl: string;
  shareReady: boolean;
}

export interface CaptureSnapshot {
  asset?: CaptureAsset;
  elapsedMs: number;
  error?: CaptureError;
  finalizeProgress?: number;
  mode: CaptureMode;
  phase: CapturePhase;
}
