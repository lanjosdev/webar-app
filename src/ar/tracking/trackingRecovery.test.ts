import {beforeEach, describe, expect, it} from 'vitest';

import type {RealityResult} from '../engine/engineTypes';
import {createTrackingRecoveryController} from './trackingRecovery';
import {TrackingState} from './trackingState';

const normal: RealityResult = {trackingStatus: 'NORMAL'};
const limited: RealityResult = {trackingStatus: 'LIMITED'};

describe('TrackingRecoveryController', () => {
  let state: TrackingState;
  let recovery: ReturnType<typeof createTrackingRecoveryController>;

  beforeEach(() => {
    state = new TrackingState();
    recovery = createTrackingRecoveryController(state);
  });

  const reachStableTracking = (startedAt = 0): void => {
    expect(recovery.update(normal, startedAt)).toBe(false);
    expect(recovery.update(normal, startedAt + 500)).toBe(true);
    expect(state.current.phase).toBe('tracking-ready');
  };

  it('requires 500 ms of NORMAL tracking before becoming ready', () => {
    expect(recovery.update(normal, 0)).toBe(false);
    expect(recovery.update(normal, 499)).toBe(false);
    expect(state.current.phase).toBe('idle');

    expect(recovery.update(normal, 500)).toBe(true);
    expect(state.current.phase).toBe('tracking-ready');
    expect(recovery.canRecenter()).toBe(true);
  });

  it('keeps initialization active while tracking has never been normal', () => {
    expect(recovery.update(limited, 0)).toBe(false);
    expect(recovery.update(undefined, 1_000)).toBe(false);

    expect(state.current.phase).toBe('tracking-initializing');
    expect(recovery.canRecenter()).toBe(false);
  });

  it('shows limited tracking only after 750 ms of continuous unsafe results', () => {
    reachStableTracking();

    expect(recovery.update(limited, 600)).toBe(false);
    expect(recovery.update(limited, 1_349)).toBe(false);
    expect(state.current.phase).toBe('tracking-ready');

    expect(recovery.update(limited, 1_350)).toBe(false);
    expect(state.current.phase).toBe('tracking-limited');
  });

  it('restarts the NORMAL stability window after an unsafe frame', () => {
    reachStableTracking();
    recovery.update(limited, 600);

    expect(recovery.update(normal, 700)).toBe(false);
    expect(recovery.update(normal, 1_199)).toBe(false);
    expect(recovery.update(normal, 1_200)).toBe(true);
    expect(state.current.phase).toBe('tracking-ready');
  });

  it('preserves placement while paused and recovers before enabling interaction', () => {
    reachStableTracking();
    state.markObjectPlaced();

    recovery.beginPaused(600);
    expect(state.current).toEqual({phase: 'paused', placement: 'placed'});

    recovery.beginResuming(1_000);
    expect(state.current).toEqual({phase: 'tracking-recovering', placement: 'placed'});
    expect(recovery.update(normal, 1_000)).toBe(false);
    expect(recovery.update(normal, 1_499)).toBe(false);
    expect(recovery.update(normal, 1_500)).toBe(true);
    expect(state.current).toEqual({phase: 'tracking-ready', placement: 'placed'});
  });

  it('returns to initialization when resuming before tracking was ever ready', () => {
    recovery.beginPaused(0);
    recovery.beginResuming(100);

    expect(state.current.phase).toBe('tracking-initializing');
    expect(recovery.canRecenter()).toBe(false);
  });

  it('allows recentering only after stable tracking and clears placement', () => {
    expect(recovery.beginRecentering(0)).toBe(false);
    reachStableTracking();
    state.markObjectPlaced();

    expect(recovery.beginRecentering(600)).toBe(true);
    expect(recovery.beginRecentering(700)).toBe(false);
    expect(state.current).toEqual({
      phase: 'tracking-recovering',
      placement: 'not-placed',
    });

    expect(recovery.update(normal, 700)).toBe(false);
    expect(recovery.update(normal, 1_200)).toBe(true);
    expect(recovery.canRecenter()).toBe(true);
  });

  it('leaves recovery as limited after the 8 second timeout', () => {
    reachStableTracking();
    expect(recovery.beginRecentering(1_000)).toBe(true);

    recovery.update(limited, 8_999);
    expect(state.current.phase).toBe('tracking-recovering');

    recovery.update(limited, 9_000);
    expect(state.current.phase).toBe('tracking-limited');
  });
});
