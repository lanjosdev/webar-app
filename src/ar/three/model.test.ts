import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {
  loadPlacementModel,
  PLACEMENT_MODEL_MAX_DIMENSION,
  PLACEMENT_MODEL_CREASE_ANGLE,
  PLACEMENT_MODEL_METALNESS,
  PLACEMENT_MODEL_ROUGHNESS,
  PLACEMENT_SHADOW_OPACITY,
  preparePlacementModel,
} from './model';

afterEach(() => {
  vi.useRealTimers();
});

describe('preparePlacementModel', () => {
  it('normalizes the largest dimension and centers the base at the local origin', () => {
    const source = new Group();
    const geometry = new BoxGeometry(2, 4, 1);
    const material = new MeshStandardMaterial();
    const mesh = new Mesh(geometry, material);
    mesh.position.set(10, 3, -4);
    source.add(mesh);

    const model = preparePlacementModel(source);
    const normalizedContent = model.root.getObjectByName(
      'model-normalized-content',
    );
    expect(normalizedContent).toBeDefined();
    const bounds = new Box3().setFromObject(normalizedContent!, true);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());

    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(
      PLACEMENT_MODEL_MAX_DIMENSION,
    );
    expect(bounds.min.y).toBeCloseTo(0);
    expect(center.x).toBeCloseTo(0);
    expect(center.z).toBeCloseTo(0);
    expect(model.root.visible).toBe(false);

    model.dispose();
  });

  it('applies the default silver polished finish to compatible GLB materials', () => {
    const source = new Group();
    const material = new MeshStandardMaterial({
      color: 0x4a90e2,
      metalness: 0,
      roughness: 1,
    });
    source.add(new Mesh(new BoxGeometry(1, 1, 1), material));

    const model = preparePlacementModel(source);

    expect(material.color.getHex()).toBe(0xffffff);
    expect(material.metalness).toBe(PLACEMENT_MODEL_METALNESS);
    expect(material.roughness).toBe(PLACEMENT_MODEL_ROUGHNESS);

    model.dispose();
  });

  it('applies a selected appearance before the placement model is returned', () => {
    const source = new Group();
    const material = new MeshStandardMaterial();
    source.add(new Mesh(new BoxGeometry(1, 1, 1), material));

    const model = preparePlacementModel(source, PLACEMENT_MODEL_MAX_DIMENSION, {
      color: 'graphite',
      finish: 'satin',
    });

    expect(material.color.getHex()).toBe(0x2f3237);
    expect(material.roughness).toBe(0.3);
    expect(model.root.visible).toBe(false);

    model.dispose();
  });

  it('smooths shallow geometry facets while preserving sharp creases', () => {
    const source = new Group();
    const geometry = new CylinderGeometry(1, 1, 1, 8, 1, true).toNonIndexed();
    geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, new MeshStandardMaterial());
    source.add(mesh);

    const model = preparePlacementModel(source);
    const positions = mesh.geometry.getAttribute('position');
    const normals = mesh.geometry.getAttribute('normal');
    const normalsByPosition = new Map<string, Set<string>>();

    for (let index = 0; index < positions.count; index += 1) {
      const positionKey = [positions.getX(index), positions.getY(index), positions.getZ(index)]
        .map((value) => value.toFixed(5))
        .join(',');
      const normalKey = [normals.getX(index), normals.getY(index), normals.getZ(index)]
        .map((value) => value.toFixed(4))
        .join(',');
      const normalSet = normalsByPosition.get(positionKey) ?? new Set<string>();
      normalSet.add(normalKey);
      normalsByPosition.set(positionKey, normalSet);
    }

    expect(PLACEMENT_MODEL_CREASE_ANGLE).toBeGreaterThan(Math.PI / 4);
    expect(
      [...normalsByPosition.values()]
        .filter((normalSet) => normalSet.size > 0)
        .every((normalSet) => normalSet.size === 1),
    ).toBe(true);

    model.dispose();
  });

  it('adds one lightweight procedural shadow below the floating model', () => {
    const source = new Group();
    source.add(new Mesh(new BoxGeometry(1, 1, 0.2), new MeshStandardMaterial()));

    const model = preparePlacementModel(source);
    const shadow = model.root.getObjectByName('placement-logo-ground-shadow');

    expect(shadow).toBeInstanceOf(Mesh);
    expect((shadow as Mesh).material).toBeInstanceOf(MeshBasicMaterial);
    const material = (shadow as Mesh).material as MeshBasicMaterial;
    expect(material.opacity).toBe(PLACEMENT_SHADOW_OPACITY);
    expect(material.depthWrite).toBe(false);
    expect(material.transparent).toBe(true);
    expect(material.map).toBeInstanceOf(DataTexture);
    const textureImage = material.map?.image as {height: number; width: number};
    expect(textureImage.width).toBe(64);
    expect(textureImage.height).toBe(64);
    expect(shadow?.position.y).toBeCloseTo(-0.146);

    model.dispose();
  });

  it('rejects an empty or degenerate scene with MODEL_LOAD_ERROR', () => {
    expect(() => preparePlacementModel(new Group())).toThrowError(
      expect.objectContaining({code: 'MODEL_LOAD_ERROR'}),
    );
  });

  it('disposes owned resources only once', () => {
    const source = new Group();
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial();
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    source.add(new Mesh(geometry, material));

    const model = preparePlacementModel(source);
    model.dispose();
    model.dispose();

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(model.root.parent).toBeNull();
    expect(model.root.children).toHaveLength(0);
  });
});

describe('loadPlacementModel', () => {
  it('loads a valid GLB response and passes the model resource path to the parser', async () => {
    const source = new Group();
    source.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    const parse = vi.fn(async () => ({scene: source}));
    const fetcher = vi.fn(async () =>
      new Response(createValidGLBHeader(), {status: 200}));

    const model = await loadPlacementModel({
      baseUrl: 'https://example.test/ar/',
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

    model.dispose();
  });

  it('maps HTTP and malformed GLB failures to MODEL_LOAD_ERROR', async () => {
    const notFound = vi.fn(async () => new Response(null, {status: 404}));
    const malformed = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {status: 200}));

    await expect(loadPlacementModel({
      baseUrl: 'https://example.test/',
      fetcher: notFound,
    })).rejects.toMatchObject({code: 'MODEL_LOAD_ERROR'});
    await expect(loadPlacementModel({
      baseUrl: 'https://example.test/',
      fetcher: malformed,
    })).rejects.toMatchObject({code: 'MODEL_LOAD_ERROR'});
  });

  it('aborts a model request after the configured timeout', async () => {
    vi.useFakeTimers();
    const fetcherMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      }));
    const fetcher = fetcherMock as typeof fetch;

    const loading = loadPlacementModel({
      baseUrl: 'https://example.test/',
      fetcher,
      timeoutMs: 25,
    });
    const rejection = expect(loading).rejects.toMatchObject({
      code: 'MODEL_LOAD_ERROR',
    });

    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    expect(fetcherMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
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
