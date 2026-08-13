import {
  Box3,
  Group,
  Material,
  Mesh,
  SkinnedMesh,
  Texture,
  Vector3,
} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

import {ARError} from '../engine/arError';

export const PLACEMENT_MODEL_URL = '/models/Logo.glb';
export const PLACEMENT_MODEL_MAX_DIMENSION = 0.75;
export const PLACEMENT_MODEL_GROUND_OFFSET = 0.15;
export const PLACEMENT_MODEL_LOAD_TIMEOUT_MS = 15_000;

interface ParsedGLTF {
  scene: Group;
}

export interface PlacementModel {
  dispose(): void;
  root: Group;
}

interface LoadPlacementModelOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
  parse?: (data: ArrayBuffer, resourcePath: string) => Promise<ParsedGLTF>;
  timeoutMs?: number;
  url?: string;
}

export async function loadPlacementModel(
  options: LoadPlacementModelOptions = {},
): Promise<PlacementModel> {
  const url = options.url ?? PLACEMENT_MODEL_URL;
  const timeoutMs = options.timeoutMs ?? PLACEMENT_MODEL_LOAD_TIMEOUT_MS;
  const baseUrl = options.baseUrl ?? document.baseURI;
  const absoluteUrl = new URL(url, baseUrl);
  const resourcePath = new URL('.', absoluteUrl).href;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException('Model load timed out.', 'TimeoutError'));
  }, timeoutMs);

  try {
    const response = await (options.fetcher ?? fetch)(absoluteUrl, {
      cache: 'default',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Model request failed with HTTP ${response.status}.`);
    }

    const data = await response.arrayBuffer();
    assertValidGLBHeader(data);

    const parse = options.parse ?? ((buffer: ArrayBuffer, path: string) =>
      new GLTFLoader().parseAsync(buffer, path));
    const gltf = await parse(data, resourcePath);

    return preparePlacementModel(gltf.scene);
  } catch (error: unknown) {
    if (error instanceof ARError) {
      throw error;
    }

    throw new ARError(
      'MODEL_LOAD_ERROR',
      'Não foi possível carregar o modelo 3D. Verifique sua conexão e tente novamente.',
      {cause: error},
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export function preparePlacementModel(
  modelScene: Group,
  targetMaxDimension = PLACEMENT_MODEL_MAX_DIMENSION,
): PlacementModel {
  let disposed = false;

  try {
    if (!Number.isFinite(targetMaxDimension) || targetMaxDimension <= 0) {
      throw new Error('Target model dimension must be positive and finite.');
    }

    modelScene.updateMatrixWorld(true);
    const sourceBounds = new Box3().setFromObject(modelScene, true);
    const sourceSize = sourceBounds.getSize(new Vector3());
    const maxDimension = Math.max(sourceSize.x, sourceSize.y, sourceSize.z);

    if (
      sourceBounds.isEmpty() ||
      !Number.isFinite(maxDimension) ||
      maxDimension <= Number.EPSILON
    ) {
      throw new Error('The model does not contain renderable geometry with valid bounds.');
    }

    const normalizedContent = new Group();
    normalizedContent.name = 'placement-model-normalized-content';
    normalizedContent.add(modelScene);
    normalizedContent.scale.setScalar(targetMaxDimension / maxDimension);
    normalizedContent.updateMatrixWorld(true);

    const normalizedBounds = new Box3().setFromObject(normalizedContent, true);
    const normalizedCenter = normalizedBounds.getCenter(new Vector3());
    normalizedContent.position.set(
      -normalizedCenter.x,
      -normalizedBounds.min.y,
      -normalizedCenter.z,
    );
    normalizedContent.updateMatrixWorld(true);

    const placementRoot = new Group();
    placementRoot.name = 'placement-logo';
    placementRoot.visible = false;
    placementRoot.add(normalizedContent);

    return {
      root: placementRoot,
      dispose(): void {
        if (disposed) {
          return;
        }

        disposed = true;
        disposeObject3D(placementRoot);
        placementRoot.removeFromParent();
        placementRoot.clear();
      },
    };
  } catch (error: unknown) {
    disposeObject3D(modelScene);
    modelScene.removeFromParent();

    throw new ARError(
      'MODEL_LOAD_ERROR',
      'O modelo 3D não contém uma cena renderizável válida.',
      {cause: error},
    );
  }
}

export function disposeObject3D(root: Group): void {
  const geometries = new Set<Mesh['geometry']>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const skeletons = new Set<SkinnedMesh['skeleton']>();

  root.traverse((object) => {
    if (object instanceof Mesh) {
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      objectMaterials.forEach((material) => {
        materials.add(material);
        collectMaterialTextures(material, textures);
      });
    }

    if (object instanceof SkinnedMesh) {
      skeletons.add(object.skeleton);
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  skeletons.forEach((skeleton) => skeleton.dispose());
  textures.forEach((texture) => {
    texture.dispose();

    const image = texture.source.data;
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) {
      image.close();
    }
  });
}

function assertValidGLBHeader(data: ArrayBuffer): void {
  if (data.byteLength < 12) {
    throw new Error('The GLB header is incomplete.');
  }

  const header = new DataView(data, 0, 12);
  const magic = header.getUint32(0, true);
  const version = header.getUint32(4, true);
  const declaredLength = header.getUint32(8, true);

  if (magic !== 0x46546c67 || version !== 2 || declaredLength !== data.byteLength) {
    throw new Error('The file is not a valid glTF 2.0 binary.');
  }
}

function collectMaterialTextures(
  material: Material,
  textures: Set<Texture>,
): void {
  Object.values(material).forEach((value: unknown) => {
    if (value instanceof Texture) {
      textures.add(value);
    }
  });

  const uniforms = 'uniforms' in material
    ? (material.uniforms as Record<string, {value?: unknown}> | undefined)
    : undefined;

  Object.values(uniforms ?? {}).forEach(({value}) => {
    if (value instanceof Texture) {
      textures.add(value);
    } else if (Array.isArray(value)) {
      value.forEach((entry: unknown) => {
        if (entry instanceof Texture) {
          textures.add(entry);
        }
      });
    }
  });
}
