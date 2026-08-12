import {describe, expect, it, vi} from 'vitest';

import type {ARSnapshot} from '../ar/tracking/trackingState';
import {synchronizeCaptureTracking} from './capture';

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

function makeActions() {
  return {
    prepare: vi.fn(),
    render: vi.fn(),
    reset: vi.fn(),
  };
}
