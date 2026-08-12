import {
  CaptureError,
  type CaptureAsset,
  type CaptureKind,
} from './captureTypes';

interface ShareNavigator {
  canShare?: (data?: ShareData) => boolean;
  share?: (data?: ShareData) => Promise<void>;
}

export type ShareResult = 'cancelled' | 'shared' | 'unsupported';

export function jpegBase64ToBlob(base64: string): Blob {
  try {
    const normalized = base64.replace(/^data:image\/jpeg;base64,/, '');
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], {type: 'image/jpeg'});
  } catch (error: unknown) {
    throw new CaptureError(
      'PHOTO_CAPTURE_FAILED',
      'Não foi possível preparar a foto capturada.',
      {cause: error},
    );
  }
}

export function createCaptureAsset(options: {
  blob: Blob;
  createdAt?: Date;
  durationMs?: number;
  kind: CaptureKind;
  mimeType?: string;
  shareReady?: boolean;
}): CaptureAsset {
  const createdAt = options.createdAt ?? new Date();
  const mimeType = options.mimeType || getDefaultMimeType(options.kind);
  const extension = getExtension(mimeType, options.kind);
  const prefix = options.kind === 'photo' ? 'webar-photo' : 'webar-video';
  const fileName = `${prefix}-${formatTimestamp(createdAt)}.${extension}`;
  const typedBlob = options.blob.type === mimeType
    ? options.blob
    : new Blob([options.blob], {type: mimeType});
  const file = new File([typedBlob], fileName, {type: mimeType});

  return {
    blob: typedBlob,
    bytes: typedBlob.size,
    createdAt: createdAt.toISOString(),
    durationMs: options.durationMs,
    file,
    kind: options.kind,
    mimeType,
    objectUrl: URL.createObjectURL(typedBlob),
    shareReady: options.shareReady ?? true,
  };
}

export function disposeCaptureAsset(asset?: CaptureAsset): void {
  if (asset) {
    URL.revokeObjectURL(asset.objectUrl);
  }
}

export async function shareCaptureAsset(
  asset: CaptureAsset,
  shareNavigator: ShareNavigator = navigator,
): Promise<ShareResult> {
  const data: ShareData = {
    files: [asset.file],
    text: 'Confira esta experiência em realidade aumentada.',
    title: 'Experiência WebAR',
  };

  if (
    !asset.shareReady ||
    !shareNavigator.share ||
    !shareNavigator.canShare?.({files: [asset.file]})
  ) {
    return 'unsupported';
  }

  try {
    await shareNavigator.share(data);
    return 'shared';
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'cancelled';
    }

    throw new CaptureError('SHARE_FAILED', 'Não foi possível compartilhar este arquivo.', {
      cause: error,
    });
  }
}

export function downloadCaptureAsset(asset: CaptureAsset): void {
  const anchor = document.createElement('a');
  anchor.href = asset.objectUrl;
  anchor.download = asset.file.name;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function getDefaultMimeType(kind: CaptureKind): string {
  return kind === 'photo' ? 'image/jpeg' : 'video/mp4';
}

function getExtension(mimeType: string, kind: CaptureKind): string {
  if (mimeType.includes('webm')) {
    return 'webm';
  }

  return kind === 'photo' ? 'jpg' : 'mp4';
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
