import {describe, expect, it} from 'vitest';

import {CaptureMetrics} from './captureMetrics';

describe('CaptureMetrics', () => {
  it('aggregates every photo and video instead of retaining only the last one', () => {
    const metrics = new CaptureMetrics();
    metrics.record('photo-ready', {bytes: 30_000, latencyMs: 100});
    metrics.record('photo-ready', {bytes: 50_000, latencyMs: 300});
    metrics.record('video-start');
    metrics.record('video-stop', {averageFps: 16});
    metrics.record('video-ready', {bytes: 2_000_000, finalizationMs: 8_000});
    metrics.record('video-start');
    metrics.record('video-stop', {averageFps: 12});
    metrics.record('video-ready', {bytes: 3_000_000, finalizationMs: 10_000});
    metrics.record('video-finalization-complete');
    metrics.record('video-start-blocked');

    expect(metrics.snapshot()).toMatchObject({
      photos: {
        bytes: {average: 40_000, count: 2, median: 40_000},
        latencyMs: {average: 200, count: 2, median: 200},
        ready: 2,
      },
      videos: {
        backgroundFinalizations: 1,
        blockedStarts: 1,
        bytes: {average: 2_500_000, count: 2, median: 2_500_000},
        finalizationMs: {average: 9_000, count: 2, median: 9_000},
        fps: {average: 14, count: 2, median: 14},
        ready: 2,
        started: 2,
        stopped: 2,
      },
    });
  });

  it('counts discarded previews independently from finalized media', () => {
    const metrics = new CaptureMetrics();
    metrics.record('discard');
    metrics.record('discard');

    expect(metrics.snapshot().discards).toBe(2);
    expect(metrics.snapshot().videos.fps).toEqual({count: 0});
  });
});
