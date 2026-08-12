import {describe, expect, it} from 'vitest';

import {CaptureState} from './captureState';
import {CaptureError, type CaptureAsset} from './captureTypes';

describe('CaptureState', () => {
  it('starts unavailable and changes mode only from an interactive state', () => {
    const state = new CaptureState();

    state.setMode('video');
    expect(state.current).toMatchObject({mode: 'photo', phase: 'unavailable'});

    state.setReady();
    state.setMode('video');
    expect(state.current).toMatchObject({mode: 'video', phase: 'ready'});
  });

  it('caps recording elapsed time at ten seconds', () => {
    const state = new CaptureState();
    state.setRecording();

    state.setElapsed(12_500);

    expect(state.current.elapsedMs).toBe(10_000);
  });

  it('normalizes finalization progress', () => {
    const state = new CaptureState();
    state.setRecording();
    state.setFinalizing(1.4);

    expect(state.current).toMatchObject({finalizeProgress: 1, phase: 'finalizing'});

    state.setFinalizeProgress(-0.2);
    expect(state.current.finalizeProgress).toBe(0);
  });

  it('keeps the captured asset while sharing and returning to preview', () => {
    const state = new CaptureState();
    const asset = makeAsset();

    state.setPreview(asset);
    state.setSharing();
    expect(state.current).toMatchObject({asset, phase: 'sharing'});

    state.restorePreview();
    expect(state.current).toMatchObject({asset, phase: 'preview'});
  });

  it('uses a recoverable error state', () => {
    const state = new CaptureState();
    const error = new CaptureError('PHOTO_CAPTURE_FAILED', 'Failed');

    state.fail(error);
    expect(state.current).toMatchObject({error, phase: 'error'});

    state.setReady();
    expect(state.current).toEqual({elapsedMs: 0, mode: 'photo', phase: 'ready'});
  });
});

function makeAsset(): CaptureAsset {
  const blob = new Blob(['capture'], {type: 'image/jpeg'});
  return {
    blob,
    bytes: blob.size,
    createdAt: '2026-08-11T12:00:00.000Z',
    file: new File([blob], 'capture.jpg', {type: blob.type}),
    kind: 'photo',
    mimeType: blob.type,
    objectUrl: 'blob:capture',
    shareReady: true,
  };
}
