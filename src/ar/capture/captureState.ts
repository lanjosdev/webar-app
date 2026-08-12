import type {
  CaptureAsset,
  CaptureError,
  CaptureMode,
  CaptureSnapshot,
} from './captureTypes';
import {CAPTURE_VIDEO_MAX_DURATION_MS} from './captureTypes';

type Subscriber = (snapshot: CaptureSnapshot) => void;

export class CaptureState {
  private snapshot: CaptureSnapshot = {
    elapsedMs: 0,
    mode: 'photo',
    phase: 'unavailable',
  };
  private readonly subscribers = new Set<Subscriber>();

  get current(): CaptureSnapshot {
    return this.snapshot;
  }

  setMode(mode: CaptureMode): void {
    if (this.snapshot.mode === mode || !this.canChangeMode()) {
      return;
    }

    this.publish({...this.snapshot, mode});
  }

  setPreparing(): void {
    this.publish({elapsedMs: 0, mode: this.snapshot.mode, phase: 'preparing'});
  }

  setReady(): void {
    this.publish({elapsedMs: 0, mode: this.snapshot.mode, phase: 'ready'});
  }

  setCapturingPhoto(): void {
    this.publish({elapsedMs: 0, mode: 'photo', phase: 'capturing-photo'});
  }

  setRecording(): void {
    this.publish({elapsedMs: 0, mode: 'video', phase: 'recording'});
  }

  setElapsed(elapsedMs: number): void {
    if (this.snapshot.phase !== 'recording') {
      return;
    }

    this.publish({
      ...this.snapshot,
      elapsedMs: Math.min(CAPTURE_VIDEO_MAX_DURATION_MS, Math.max(0, elapsedMs)),
    });
  }

  setFinalizing(progress?: number): void {
    this.publish({
      ...this.snapshot,
      elapsedMs: Math.min(this.snapshot.elapsedMs, CAPTURE_VIDEO_MAX_DURATION_MS),
      finalizeProgress: normalizeProgress(progress),
      phase: 'finalizing',
    });
  }

  setFinalizeProgress(progress: number): void {
    if (this.snapshot.phase !== 'finalizing' && this.snapshot.phase !== 'preview') {
      return;
    }

    this.publish({...this.snapshot, finalizeProgress: normalizeProgress(progress)});
  }

  setPreview(asset: CaptureAsset, finalizing = false): void {
    this.publish({
      asset,
      elapsedMs: this.snapshot.elapsedMs,
      finalizeProgress: finalizing ? this.snapshot.finalizeProgress : 1,
      mode: asset.kind,
      phase: 'preview',
    });
  }

  setSharing(): void {
    if (!this.snapshot.asset) {
      return;
    }

    this.publish({...this.snapshot, phase: 'sharing'});
  }

  restorePreview(): void {
    if (!this.snapshot.asset) {
      return;
    }

    this.publish({...this.snapshot, phase: 'preview'});
  }

  fail(error: CaptureError): void {
    this.publish({elapsedMs: 0, error, mode: this.snapshot.mode, phase: 'error'});
  }

  reset(): void {
    this.publish({elapsedMs: 0, mode: this.snapshot.mode, phase: 'unavailable'});
  }

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.snapshot);

    return () => this.subscribers.delete(subscriber);
  }

  private canChangeMode(): boolean {
    return this.snapshot.phase === 'ready' || this.snapshot.phase === 'error';
  }

  private publish(snapshot: CaptureSnapshot): void {
    this.snapshot = snapshot;
    this.subscribers.forEach((subscriber) => subscriber(snapshot));
  }
}

function normalizeProgress(progress?: number): number | undefined {
  if (progress === undefined || !Number.isFinite(progress)) {
    return undefined;
  }

  return Math.min(1, Math.max(0, progress));
}
