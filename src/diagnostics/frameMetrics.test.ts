import {describe, expect, it} from 'vitest';

import {FrameMetrics} from './frameMetrics';

describe('FrameMetrics', () => {
  it('aggregates FPS, p95 and slow frames from bounded samples', () => {
    const metrics = new FrameMetrics(10, 50);
    metrics.record(0);
    metrics.record(16);
    metrics.record(32);
    metrics.record(82);

    expect(metrics.snapshot()).toEqual({
      averageFps: 36.59,
      frameCount: 3,
      p95FrameMs: 50,
      slowFrames: 1,
    });
  });

  it('ignores lifecycle gaps longer than one second', () => {
    const metrics = new FrameMetrics();
    metrics.record(0);
    metrics.record(1_500);
    metrics.record(1_516);

    expect(metrics.snapshot()).toMatchObject({
      averageFps: 62.5,
      frameCount: 1,
      slowFrames: 0,
    });
  });

  it('excludes a lifecycle pause even when it is shorter than one second', () => {
    const metrics = new FrameMetrics();
    metrics.record(0);
    metrics.record(16);
    metrics.resetClock();
    metrics.record(516);
    metrics.record(532);

    expect(metrics.snapshot()).toMatchObject({
      averageFps: 62.5,
      frameCount: 2,
      slowFrames: 0,
    });
  });
});
