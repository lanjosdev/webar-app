import {
  Box3,
  BufferGeometry,
  Group,
  Material,
  Mesh,
  type Object3D,
  SkinnedMesh,
  Texture,
  Vector3,
} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {
  applyModelAppearance,
  collectModelAppearanceMaterials,
  DEFAULT_MODEL_APPEARANCE,
  MODEL_APPEARANCE_METALNESS,
  MODEL_FINISH_OPTIONS,
  type ModelAppearanceConfig,
} from './modelAppearance';

export const MODEL_ASSET_URL = '/models/Logo.glb';
export const MODEL_ASSET_MAX_DIMENSION = 0.75;
export const MODEL_ASSET_LOAD_TIMEOUT_MS = 15_000;
export const MODEL_ASSET_METALNESS = MODEL_APPEARANCE_METALNESS;
export const MODEL_ASSET_ROUGHNESS =
  MODEL_FINISH_OPTIONS.find(({id}) => id === 'polished')?.roughness ?? 0.12;
export const MODEL_ASSET_CREASE_ANGLE = Math.PI * (70 / 180);

const SMOOTHING_REFERENCE_SIZE = 100;

interface ParsedGLTF {
  scene: Group;
}

export interface ModelAsset {
  dispose(): void;
  readonly root: Group;
  setAppearance(appearance: ModelAppearanceConfig): void;
  readonly size: Vector3;
}

export interface LoadModelAssetOptions {
  appearance?: ModelAppearanceConfig;
  baseUrl?: string;
  fetcher?: typeof fetch;
  parse?: (data: ArrayBuffer, resourcePath: string) => Promise<ParsedGLTF>;
  targetMaxDimension?: number;
  timeoutMs?: number;
  url?: string;
}

export class ModelAssetError extends Error {
  readonly code = 'MODEL_LOAD_ERROR';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ModelAssetError';
  }
}

export async function loadModelAsset(
  options: LoadModelAssetOptions = {},
): Promise<ModelAsset> {
  const url = options.url ?? MODEL_ASSET_URL;
  const timeoutMs = options.timeoutMs ?? MODEL_ASSET_LOAD_TIMEOUT_MS;
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

    const parse =
      options.parse ??
      ((buffer: ArrayBuffer, path: string) =>
        new GLTFLoader().parseAsync(buffer, path));
    const gltf = await parse(data, resourcePath);

    return prepareModelAsset(
      gltf.scene,
      options.targetMaxDimension ?? MODEL_ASSET_MAX_DIMENSION,
      options.appearance,
    );
  } catch (error: unknown) {
    if (error instanceof ModelAssetError) {
      throw error;
    }

    throw new ModelAssetError(
      'Não foi possível carregar o modelo 3D. Verifique sua conexão e tente novamente.',
      {cause: error},
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export function prepareModelAsset(
  modelScene: Group,
  targetMaxDimension = MODEL_ASSET_MAX_DIMENSION,
  appearance: ModelAppearanceConfig = {...DEFAULT_MODEL_APPEARANCE},
): ModelAsset {
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
      throw new Error(
        'The model does not contain renderable geometry with valid bounds.',
      );
    }

    applyCreasedSmoothNormals(modelScene);
    const appearanceMaterials = collectModelAppearanceMaterials(modelScene);
    applyModelAppearance(appearanceMaterials, appearance);

    const normalizedContent = new Group();
    normalizedContent.name = 'model-normalized-content';
    normalizedContent.add(modelScene);
    normalizedContent.scale.setScalar(targetMaxDimension / maxDimension);
    normalizedContent.updateMatrixWorld(true);

    const normalizedBounds = new Box3().setFromObject(normalizedContent, true);
    const normalizedSize = normalizedBounds.getSize(new Vector3());
    const normalizedCenter = normalizedBounds.getCenter(new Vector3());
    normalizedContent.position.set(
      -normalizedCenter.x,
      -normalizedBounds.min.y,
      -normalizedCenter.z,
    );
    normalizedContent.updateMatrixWorld(true);

    return {
      root: normalizedContent,
      size: normalizedSize.clone(),
      setAppearance(nextAppearance): void {
        if (!disposed) {
          applyModelAppearance(appearanceMaterials, nextAppearance);
        }
      },
      dispose(): void {
        if (disposed) {
          return;
        }

        disposed = true;
        disposeObject3D(normalizedContent);
        normalizedContent.removeFromParent();
        normalizedContent.clear();
      },
    };
  } catch (error: unknown) {
    disposeObject3D(modelScene);
    modelScene.removeFromParent();

    if (error instanceof ModelAssetError) {
      throw error;
    }

    throw new ModelAssetError(
      'O modelo 3D não contém uma cena renderizável válida.',
      {cause: error},
    );
  }
}

export function applyMetallicFinish(root: Object3D): void {
  applyModelAppearance(
    collectModelAppearanceMaterials(root),
    {...DEFAULT_MODEL_APPEARANCE},
  );
}

export function applyCreasedSmoothNormals(root: Object3D): void {
  const meshesByGeometry = new Map<BufferGeometry, Mesh[]>();

  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    const meshes = meshesByGeometry.get(object.geometry) ?? [];
    meshes.push(object);
    meshesByGeometry.set(object.geometry, meshes);
  });

  meshesByGeometry.forEach((meshes, sourceGeometry) => {
    const smoothedGeometry = createCreasedSmoothGeometry(sourceGeometry);
    meshes.forEach((mesh) => {
      mesh.geometry = smoothedGeometry;
    });
    sourceGeometry.dispose();
  });
}

export function disposeObject3D(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const skeletons = new Set<SkinnedMesh['skeleton']>();

  root.traverse((object) => {
    const renderable = object as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };

    if (renderable.geometry instanceof BufferGeometry) {
      geometries.add(renderable.geometry);
    }

    if (renderable.material) {
      const objectMaterials = Array.isArray(renderable.material)
        ? renderable.material
        : [renderable.material];

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

function createCreasedSmoothGeometry(sourceGeometry: BufferGeometry): BufferGeometry {
  const workingGeometry = sourceGeometry.clone();
  let smoothedGeometry: BufferGeometry | undefined;

  try {
    workingGeometry.computeBoundingBox();
    const size = workingGeometry.boundingBox?.getSize(new Vector3());
    const maxDimension = size ? Math.max(size.x, size.y, size.z) : 0;

    if (!Number.isFinite(maxDimension) || maxDimension <= Number.EPSILON) {
      workingGeometry.computeVertexNormals();
      return workingGeometry;
    }

    const smoothingScale = SMOOTHING_REFERENCE_SIZE / maxDimension;
    workingGeometry.scale(smoothingScale, smoothingScale, smoothingScale);
    smoothedGeometry = toCreasedNormals(
      workingGeometry,
      MODEL_ASSET_CREASE_ANGLE,
    );

    if (smoothedGeometry !== workingGeometry) {
      workingGeometry.dispose();
    }

    const inverseScale = 1 / smoothingScale;
    smoothedGeometry.scale(inverseScale, inverseScale, inverseScale);
    smoothedGeometry.computeBoundingBox();
    smoothedGeometry.computeBoundingSphere();

    return smoothedGeometry;
  } catch (error: unknown) {
    if (smoothedGeometry && smoothedGeometry !== workingGeometry) {
      smoothedGeometry.dispose();
    }
    workingGeometry.dispose();
    throw error;
  }
}

function assertValidGLBHeader(data: ArrayBuffer): void {
  if (data.byteLength < 12) {
    throw new Error('The GLB header is incomplete.');
  }

  const header = new DataView(data, 0, 12);
  const magic = header.getUint32(0, true);
  const version = header.getUint32(4, true);
  const declaredLength = header.getUint32(8, true);

  if (
    magic !== 0x46546c67 ||
    version !== 2 ||
    declaredLength !== data.byteLength
  ) {
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

  const uniforms =
    'uniforms' in material
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
