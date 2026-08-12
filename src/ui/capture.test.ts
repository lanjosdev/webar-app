import {describe, expect, it, vi} from 'vitest';

import type {ARSnapshot} from '../ar/tracking/trackingState';
import {
  getCaptureControlAvailability,
  synchronizeCaptureTracking,
} from './capture';

describe('synchronizeCaptureTracking', () => {
  it('renders before reusing an already prepared capture session after preview', () => {
    const actions = makeActions();
    const readyAndPlaced: ARSnapshot = {
      phase: 'tracking-ready',
      placement: 'placed',
    };

    synchronizeCaptureTracking(readyAndPlaced, actions);

    expect(actions.render).toHaveBeenCalledOnce();
    expect(actions.prepare).toHaveBeenCalledOnce();
    expect(actions.render.mock.invocationCallOrder[0]).toBeLessThan(
      actions.prepare.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(actions.reset).not.toHaveBeenCalled();
  });

  it('renders recovery and placement transitions without preparing capture', () => {
    const actions = makeActions();

    synchronizeCaptureTracking(
      {phase: 'tracking-recovering', placement: 'not-placed'},
      actions,
    );

    expect(actions.render).toHaveBeenCalledOnce();
    expect(actions.prepare).not.toHaveBeenCalled();
    expect(actions.reset).not.toHaveBeenCalled();
  });

  it('resets capture resources when the AR session becomes idle', () => {
    const actions = makeActions();

    synchronizeCaptureTracking({phase: 'idle', placement: 'not-placed'}, actions);

    expect(actions.reset).toHaveBeenCalledOnce();
    expect(actions.render).not.toHaveBeenCalled();
    expect(actions.prepare).not.toHaveBeenCalled();
  });
});

describe('getCaptureControlAvailability', () => {
  const trackingReady = {phase: 'tracking-ready', placement: 'placed'} as const;

  it('keeps photo available while a previous video is finalizing', () => {
    expect(getCaptureControlAvailability(
      {elapsedMs: 0, mode: 'photo', phase: 'ready'},
      trackingReady,
      true,
    )).toEqual({
      photoEnabled: true,
      shutterEnabled: true,
      videoEnabled: false,
    });
  });

  it('blocks the video shutter until finalization completes', () => {
    expect(getCaptureControlAvailability(
      {elapsedMs: 0, mode: 'video', phase: 'ready'},
      trackingReady,
      true,
    )).toEqual({
      photoEnabled: true,
      shutterEnabled: false,
      videoEnabled: false,
    });
  });
});

function makeActions() {
  return {
    prepare: vi.fn(),
    render: vi.fn(),
    reset: vi.fn(),
  };
}
