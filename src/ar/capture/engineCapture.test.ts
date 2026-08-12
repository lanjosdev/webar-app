import {describe, expect, it, vi} from 'vitest';

import type {MediaRecorderCallbacks, XR8} from '../engine/engineTypes';
import {createEngineCaptureSession} from './engineCapture';

describe('createEngineCaptureSession', () => {
  it('configures and exposes the official XR8 capture modules', () => {
    const fixture = makeXR8();
    const session = createEngineCaptureSession(fixture.xr8);

    expect(fixture.screenshotConfigure).toHaveBeenCalledWith({
      jpgCompression: 75,
      maxDimension: 1280,
    });
    expect(fixture.recorderConfigure).toHaveBeenCalledWith({
      enableEndCard: false,
      maxDimension: 720,
      maxDurationMs: 10_000,
      requestMic: 'manual',
    });
    expect(session.modules).toHaveLength(2);
  });

  it('returns a JPEG blob from the screenshot module', async () => {
    const fixture = makeXR8();
    const session = createEngineCaptureSession(fixture.xr8);

    const blob = await session.takePhoto();

    expect(blob.type).toBe('image/jpeg');
    expect(await blob.text()).toBe('jpeg');
  });

  it('stops an active recording once and forwards lifecycle callbacks', () => {
    const fixture = makeXR8();
    const onStart = vi.fn();
    const onStop = vi.fn();
    const session = createEngineCaptureSession(fixture.xr8);

    session.startVideo({onStart, onStop});
    fixture.callbacks?.onStart?.();
    expect(onStart).toHaveBeenCalledOnce();

    session.stopVideo();
    expect(fixture.stopRecording).toHaveBeenCalledOnce();
    session.destroy();
    expect(fixture.stopRecording).toHaveBeenCalledOnce();
    fixture.callbacks?.onStop?.();
    expect(onStop).toHaveBeenCalledOnce();

    session.stopVideo();
    expect(fixture.stopRecording).toHaveBeenCalledOnce();
  });
});

function makeXR8(): {
  callbacks?: MediaRecorderCallbacks;
  recorderConfigure: ReturnType<typeof vi.fn>;
  screenshotConfigure: ReturnType<typeof vi.fn>;
  stopRecording: ReturnType<typeof vi.fn>;
  xr8: XR8;
} {
  const fixture: ReturnType<typeof makeXR8> = {
    callbacks: undefined,
    recorderConfigure: vi.fn(),
    screenshotConfigure: vi.fn(),
    stopRecording: vi.fn(),
    xr8: undefined as unknown as XR8,
  };
  fixture.xr8 = {
    CanvasScreenshot: {
      configure: fixture.screenshotConfigure,
      pipelineModule: () => ({name: 'screenshot'}),
      takeScreenshot: vi.fn().mockResolvedValue(btoa('jpeg')),
    },
    MediaRecorder: {
      RequestMicOptions: {AUTO: 'auto', MANUAL: 'manual'},
      configure: fixture.recorderConfigure,
      pipelineModule: () => ({name: 'recorder'}),
      recordVideo: (callbacks: MediaRecorderCallbacks) => {
        fixture.callbacks = callbacks;
      },
      stopRecording: fixture.stopRecording,
    },
  } as unknown as XR8;
  return fixture;
}
