import {afterEach, describe, expect, it, vi} from 'vitest';

import {
  createCaptureAsset,
  disposeCaptureAsset,
  jpegBase64ToBlob,
  shareCaptureAsset,
} from './captureMedia';

afterEach(() => vi.restoreAllMocks());

describe('capture media helpers', () => {
  it('converts the Engine JPEG base64 payload to a typed blob', async () => {
    const blob = jpegBase64ToBlob(btoa('jpeg-bytes'));

    expect(blob.type).toBe('image/jpeg');
    expect(await blob.text()).toBe('jpeg-bytes');
  });

  it('creates a deterministic local file and releases its object URL', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const asset = createCaptureAsset({
      blob: new Blob(['photo'], {type: 'image/jpeg'}),
      createdAt: new Date('2026-08-11T12:00:00.000Z'),
      kind: 'photo',
    });

    expect(asset.file.name).toBe('webar-photo-20260811T120000Z.jpg');
    expect(asset.shareReady).toBe(true);

    disposeCaptureAsset(asset);
    expect(revoke).toHaveBeenCalledWith(asset.objectUrl);
  });

  it('shares only when the browser accepts the captured file', async () => {
    const asset = createCaptureAsset({
      blob: new Blob(['video'], {type: 'video/mp4'}),
      kind: 'video',
    });
    const share = vi.fn().mockResolvedValue(undefined);

    await expect(
      shareCaptureAsset(asset, {canShare: () => true, share}),
    ).resolves.toBe('shared');
    expect(share).toHaveBeenCalledOnce();
    disposeCaptureAsset(asset);
  });

  it('handles unsupported and cancelled native sharing without an error', async () => {
    const asset = createCaptureAsset({
      blob: new Blob(['photo'], {type: 'image/jpeg'}),
      kind: 'photo',
    });

    await expect(
      shareCaptureAsset(asset, {canShare: () => false, share: vi.fn()}),
    ).resolves.toBe('unsupported');
    await expect(
      shareCaptureAsset(asset, {
        canShare: () => true,
        share: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')),
      }),
    ).resolves.toBe('cancelled');
    disposeCaptureAsset(asset);
  });
});
