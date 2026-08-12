export type DiagnosticMilestone =
  | 'start-intent'
  | 'engine-ready'
  | 'slam-ready'
  | 'xr-run'
  | 'camera-video'
  | 'pipeline-start'
  | 'tracking-ready'
  | 'first-placement'
  | 'ar-paused'
  | 'ar-resumed';

export type CaptureDiagnosticEvent =
  | 'photo-start'
  | 'photo-ready'
  | 'video-start'
  | 'video-stop'
  | 'video-preview'
  | 'video-ready'
  | 'video-finalization-background'
  | 'video-finalization-complete'
  | 'video-start-blocked'
  | 'share-start'
  | 'share-complete'
  | 'share-cancelled'
  | 'share-unsupported'
  | 'download'
  | 'discard';

export interface DiagnosticsSink {
  mark(name: DiagnosticMilestone): void;
  recordCapture(
    event: CaptureDiagnosticEvent,
    data?: Record<string, boolean | number | string | undefined>,
  ): void;
  recordError(source: 'ar' | 'capture' | 'share', error: unknown): void;
  recordFrame(now?: number): void;
}
