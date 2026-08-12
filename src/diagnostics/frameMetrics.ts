const DEFAULT_SAMPLE_CAPACITY = 600;
const DEFAULT_SLOW_FRAME_MS = 50;

export interface FrameMetricsSnapshot {
  averageFps?: number;
  frameCount: number;
  p95FrameMs?: number;
  slowFrames: number;
}

export class FrameMetrics {
  private readonly samples: Float64Array;
  private sampleCount = 0;
  private sampleIndex = 0;
  private totalDurationMs = 0;
  private lastFrameAt: number | undefined;
  private _frameCount = 0;
  private _slowFrames = 0;

  constructor(
    sampleCapacity = DEFAULT_SAMPLE_CAPACITY,
    private readonly slowFrameMs = DEFAULT_SLOW_FRAME_MS,
  ) {
    this.samples = new Float64Array(sampleCapacity);
  }

  get frameCount(): number {
    return this._frameCount;
  }

  resetClock(): void {
    this.lastFrameAt = undefined;
  }

  record(now: number): void {
    if (this.lastFrameAt !== undefined) {
      const delta = now - this.lastFrameAt;
      if (delta > 0 && delta < 1000) {
        this.samples[this.sampleIndex] = delta;
        this.sampleIndex = (this.sampleIndex + 1) % this.samples.length;
        this.sampleCount = Math.min(this.samples.length, this.sampleCount + 1);
        this._frameCount += 1;
        this.totalDurationMs += delta;
        if (delta >= this.slowFrameMs) {
          this._slowFrames += 1;
        }
      }
    }
    this.lastFrameAt = now;
  }

  snapshot(): FrameMetricsSnapshot {
    return {
      averageFps: this.totalDurationMs > 0
        ? round(this._frameCount * 1000 / this.totalDurationMs)
        : undefined,
      frameCount: this._frameCount,
      p95FrameMs: calculateP95(this.samples, this.sampleCount),
      slowFrames: this._slowFrames,
    };
  }
}

function calculateP95(samples: Float64Array, count: number): number | undefined {
  if (count === 0) {
    return undefined;
  }
  const sorted = Array.from(samples.slice(0, count)).sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return round(sorted[index] ?? 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
