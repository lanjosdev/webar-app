import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {
  loadModelAsset,
  MODEL_ASSET_MAX_DIMENSION,
  ModelAssetError,
  prepareModelAsset,
} from './modelAsset';

afterEach(() => {
  vi.useRealTimers();
});

describe('prepareModelAsset', () => {
  it('normalizes the model without adding AR placement responsibilities', () => {
    const source = new Group();
    source.add(new Mesh(new BoxGeometry(2, 4, 1), new MeshStandardMaterial()));

    const asset = prepareModelAsset(source);
    const bounds = new Box3().setFromObject(asset.root, true);
    const size = bounds.getSize(new Vector3());

    expect(asset.root.name).toBe('model-normalized-content');
    expect(asset.root.visible).toBe(true);
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(
      MODEL_ASSET_MAX_DIMENSION,
    );
    expect(bounds.min.y).toBeCloseTo(0);
    expect(asset.root.getObjectByName('placement-logo-ground-shadow')).toBeUndefined();

    asset.dispose();
  });

  it('rejects invalid content with a neutral model asset error', () => {
    expect(() => prepareModelAsset(new Group())).toThrow(ModelAssetError);
  });

  it('owns and disposes normalized resources only once', () => {
    const source = new Group();
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial();
    const materialDispose = vi.spyOn(material, 'dispose');
    source.add(new Mesh(geometry, material));

    const asset = prepareModelAsset(source);
    asset.dispose();
    asset.dispose();

    expect(materialDispose).toHaveBeenCalledOnce();
    expect(asset.root.parent).toBeNull();
    expect(asset.root.children).toHaveLength(0);
  });
});

describe('loadModelAsset', () => {
  it('uses the browser cache and keeps resource paths relative to the GLB', async () => {
    const source = new Group();
    source.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    const parse = vi.fn(async () => ({scene: source}));
    const fetcher = vi.fn(async () =>
      new Response(createValidGLBHeader(), {status: 200}),
    );

    const asset = await loadModelAsset({
      baseUrl: 'https://example.test/showroom/',
      fetcher,
      parse,
    });

    expect(fetcher).toHaveBeenCalledWith(
      new URL('https://example.test/models/Logo.glb'),
      expect.objectContaining({cache: 'default', signal: expect.any(AbortSignal)}),
    );
    expect(parse).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      'https://example.test/models/',
    );

    asset.dispose();
  });

  it('maps HTTP, malformed GLB and timeout failures to ModelAssetError', async () => {
    const notFound = vi.fn(async () => new Response(null, {status: 404}));
    const malformed = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {status: 200}),
    );

    await expect(
      loadModelAsset({baseUrl: 'https://example.test/', fetcher: notFound}),
    ).rejects.toBeInstanceOf(ModelAssetError);
    await expect(
      loadModelAsset({baseUrl: 'https://example.test/', fetcher: malformed}),
    ).rejects.toBeInstanceOf(ModelAssetError);

    vi.useFakeTimers();
    const pendingFetcher = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    ) as typeof fetch;
    const loading = loadModelAsset({
      baseUrl: 'https://example.test/',
      fetcher: pendingFetcher,
      timeoutMs: 25,
    });
    const rejection = expect(loading).rejects.toBeInstanceOf(ModelAssetError);

    await vi.advanceTimersByTimeAsync(25);
    await rejection;
  });
});

function createValidGLBHeader(): ArrayBuffer {
  const data = new ArrayBuffer(12);
  const view = new DataView(data);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, data.byteLength, true);
  return data;
}
