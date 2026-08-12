import type {CaptureDiagnosticEvent} from './diagnosticsTypes';

export interface NumericSummary {
  average?: number;
  count: number;
  max?: number;
  median?: number;
  min?: number;
}

export interface CaptureMetricsSnapshot {
  discards: number;
  photos: {
    bytes: NumericSummary;
    latencyMs: NumericSummary;
    ready: number;
  };
  videos: {
    backgroundFinalizations: number;
    blockedStarts: number;
    bytes: NumericSummary;
    finalizationMs: NumericSummary;
    fps: NumericSummary;
    ready: number;
    started: number;
    stopped: number;
  };
}

type EventData = Record<string, boolean | number | string | undefined> | undefined;

export class CaptureMetrics {
  private discards = 0;
  private photoReady = 0;
  private videoReady = 0;
  private videoBackgroundFinalizations = 0;
  private videoBlockedStarts = 0;
  private videoStarted = 0;
  private videoStopped = 0;
  private readonly photoBytes: number[] = [];
  private readonly photoLatencyMs: number[] = [];
  private readonly videoBytes: number[] = [];
  private readonly videoFinalizationMs: number[] = [];
  private readonly videoFps: number[] = [];

  record(event: CaptureDiagnosticEvent, data?: EventData): void {
    if (event === 'photo-ready') {
      this.photoReady += 1;
      addNumber(this.photoBytes, data?.bytes);
      addNumber(this.photoLatencyMs, data?.latencyMs);
    } else if (event === 'video-start') {
      this.videoStarted += 1;
    } else if (event === 'video-stop') {
      this.videoStopped += 1;
      addNumber(this.videoFps, data?.averageFps);
    } else if (event === 'video-ready') {
      this.videoReady += 1;
      addNumber(this.videoBytes, data?.bytes);
      addNumber(this.videoFinalizationMs, data?.finalizationMs);
    } else if (event === 'video-finalization-complete') {
      this.videoBackgroundFinalizations += 1;
    } else if (event === 'video-start-blocked') {
      this.videoBlockedStarts += 1;
    } else if (event === 'discard') {
      this.discards += 1;
    }
  }

  snapshot(): CaptureMetricsSnapshot {
    return {
      discards: this.discards,
      photos: {
        bytes: summarize(this.photoBytes),
        latencyMs: summarize(this.photoLatencyMs),
        ready: this.photoReady,
      },
      videos: {
        backgroundFinalizations: this.videoBackgroundFinalizations,
        blockedStarts: this.videoBlockedStarts,
        bytes: summarize(this.videoBytes),
        finalizationMs: summarize(this.videoFinalizationMs),
        fps: summarize(this.videoFps),
        ready: this.videoReady,
        started: this.videoStarted,
        stopped: this.videoStopped,
      },
    };
  }
}

function addNumber(target: number[], value: unknown): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    target.push(value);
  }
}

function summarize(values: number[]): NumericSummary {
  if (values.length === 0) {
    return {count: 0};
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : sorted[middle];

  return {
    average: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    count: values.length,
    max: round(sorted.at(-1) ?? 0),
    median: round(median ?? 0),
    min: round(sorted[0] ?? 0),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
