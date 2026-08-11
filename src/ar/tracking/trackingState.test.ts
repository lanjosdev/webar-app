import {describe, expect, it, vi} from 'vitest';

import {ARError} from '../engine/arError';
import {TrackingState} from './trackingState';

describe('TrackingState', () => {
  it('starts idle and immediately informs new subscribers', () => {
    const state = new TrackingState();
    const subscriber = vi.fn();

    const unsubscribe = state.subscribe(subscriber);

    expect(state.current).toEqual({phase: 'idle', placement: 'not-placed'});
    expect(subscriber).toHaveBeenCalledOnce();
    expect(subscriber).toHaveBeenLastCalledWith(state.current);

    unsubscribe();
    state.setPhase('loading-engine');
    expect(subscriber).toHaveBeenCalledOnce();
  });

  it('publishes only meaningful phase and placement transitions', () => {
    const state = new TrackingState();
    const subscriber = vi.fn();
    state.subscribe(subscriber);

    state.setPhase('tracking-ready');
    state.setPhase('tracking-ready');
    state.markObjectPlaced();
    state.markObjectPlaced();

    expect(state.current).toEqual({phase: 'tracking-ready', placement: 'placed'});
    expect(subscriber).toHaveBeenCalledTimes(3);
  });

  it('clears the placement when recentering begins', () => {
    const state = new TrackingState();
    state.setPhase('tracking-ready');
    state.markObjectPlaced();

    state.beginRecentering();

    expect(state.current).toEqual({
      phase: 'tracking-recovering',
      placement: 'not-placed',
    });
  });

  it('keeps the first fatal error terminal until an explicit reset', () => {
    const state = new TrackingState();
    const firstError = new ARError('CAMERA_UNAVAILABLE', 'Camera unavailable');
    const laterError = new ARError('UNKNOWN_AR_ERROR', 'Later error');
    state.setPhase('tracking-ready');
    state.markObjectPlaced();

    state.fail(firstError);
    state.setPhase('tracking-ready');
    state.markObjectPlaced();
    state.beginRecentering();
    state.fail(laterError);

    expect(state.current).toEqual({
      error: firstError,
      phase: 'error',
      placement: 'not-placed',
    });

    state.reset();
    expect(state.current).toEqual({phase: 'idle', placement: 'not-placed'});
  });
});
