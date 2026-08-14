import {
  DataTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';

import {
  applyCreasedSmoothNormals,
  applyMetallicFinish,
  disposeObject3D,
  loadModelAsset,
  MODEL_ASSET_CREASE_ANGLE,
  MODEL_ASSET_LOAD_TIMEOUT_MS,
  MODEL_ASSET_MAX_DIMENSION,
  MODEL_ASSET_METALNESS,
  MODEL_ASSET_ROUGHNESS,
  MODEL_ASSET_URL,
  ModelAssetError,
  prepareModelAsset,
  type ModelAsset,
} from '../../three/modelAsset';
import {ARError} from '../engine/arError';
import {
  createAutoRotationController,
  type AutoRotationController,
} from './autoRotation';

export const PLACEMENT_MODEL_URL = MODEL_ASSET_URL;
export const PLACEMENT_MODEL_MAX_DIMENSION = MODEL_ASSET_MAX_DIMENSION;
export const PLACEMENT_MODEL_GROUND_OFFSET = 0.15;
export const PLACEMENT_MODEL_LOAD_TIMEOUT_MS = MODEL_ASSET_LOAD_TIMEOUT_MS;
export const PLACEMENT_MODEL_METALNESS = MODEL_ASSET_METALNESS;
export const PLACEMENT_MODEL_ROUGHNESS = MODEL_ASSET_ROUGHNESS;
export const PLACEMENT_MODEL_CREASE_ANGLE = MODEL_ASSET_CREASE_ANGLE;
export const PLACEMENT_SHADOW_OPACITY = 0.34;

const SHADOW_TEXTURE_SIZE = 64;
const SHADOW_GROUND_CLEARANCE = 0.004;
const SHADOW_WIDTH_RATIO = 0.88;
const SHADOW_DEPTH_RATIO = 0.3;

export interface PlacementModel {
  dispose(): void;
  root: Group;
  rotation: AutoRotationController;
}

interface LoadPlacementModelOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
  parse?: (
    data: ArrayBuffer,
    resourcePath: string,
  ) => Promise<{scene: Group}>;
  timeoutMs?: number;
  url?: string;
}

export async function loadPlacementModel(
  options: LoadPlacementModelOptions = {},
): Promise<PlacementModel> {
  try {
    const asset = await loadModelAsset(options);
    return createPlacementModel(asset);
  } catch (error: unknown) {
    throw toPlacementModelError(error);
  }
}

export function preparePlacementModel(
  modelScene: Group,
  targetMaxDimension = PLACEMENT_MODEL_MAX_DIMENSION,
): PlacementModel {
  try {
    return createPlacementModel(
      prepareModelAsset(modelScene, targetMaxDimension),
    );
  } catch (error: unknown) {
    throw toPlacementModelError(error);
  }
}

function createPlacementModel(asset: ModelAsset): PlacementModel {
  const placementRoot = new Group();
  placementRoot.name = 'placement-logo';
  placementRoot.visible = false;
  const normalizedMaxDimension = Math.max(asset.size.x, asset.size.y, asset.size.z);
  const shadow = createGroundShadow(asset.size, normalizedMaxDimension);
  placementRoot.add(asset.root, shadow);
  const rotation = createAutoRotationController(asset.root);
  let disposed = false;

  return {
    root: placementRoot,
    rotation,
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      rotation.dispose();
      asset.dispose();
      disposeObject3D(shadow);
      shadow.removeFromParent();
      placementRoot.removeFromParent();
      placementRoot.clear();
    },
  };
}

function createGroundShadow(
  modelSize: Vector3,
  targetMaxDimension: number,
): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const width = Math.max(
    modelSize.x * SHADOW_WIDTH_RATIO,
    targetMaxDimension * 0.4,
  );
  const depth = Math.max(
    modelSize.z * 1.25,
    targetMaxDimension * SHADOW_DEPTH_RATIO,
  );
  const texture = createRadialShadowTexture();
  const material = new MeshBasicMaterial({
    color: 0x000000,
    depthWrite: false,
    map: texture,
    opacity: PLACEMENT_SHADOW_OPACITY,
    toneMapped: false,
    transparent: true,
  });
  const shadow = new Mesh(new PlaneGeometry(width, depth), material);
  shadow.name = 'placement-logo-ground-shadow';
  shadow.position.y = -PLACEMENT_MODEL_GROUND_OFFSET + SHADOW_GROUND_CLEARANCE;
  shadow.rotation.x = -Math.PI / 2;

  return shadow;
}

function createRadialShadowTexture(): DataTexture {
  const pixels = new Uint8Array(SHADOW_TEXTURE_SIZE * SHADOW_TEXTURE_SIZE * 4);

  for (let y = 0; y < SHADOW_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < SHADOW_TEXTURE_SIZE; x += 1) {
      const normalizedX = ((x + 0.5) / SHADOW_TEXTURE_SIZE) * 2 - 1;
      const normalizedY = ((y + 0.5) / SHADOW_TEXTURE_SIZE) * 2 - 1;
      const radius = Math.sqrt(normalizedX ** 2 + normalizedY ** 2);
      const falloff = Math.max(0, 1 - radius);
      const alpha = Math.round(falloff * falloff * 255);
      const offset = (y * SHADOW_TEXTURE_SIZE + x) * 4;

      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = alpha;
    }
  }

  const texture = new DataTexture(
    pixels,
    SHADOW_TEXTURE_SIZE,
    SHADOW_TEXTURE_SIZE,
  );
  texture.name = 'placement-logo-ground-shadow-texture';
  texture.generateMipmaps = false;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

function toPlacementModelError(error: unknown): ARError {
  if (error instanceof ARError) {
    return error;
  }

  const message =
    error instanceof ModelAssetError
      ? error.message
      : 'Não foi possível carregar o modelo 3D.';

  return new ARError('MODEL_LOAD_ERROR', message, {cause: error});
}

export {
  applyCreasedSmoothNormals,
  applyMetallicFinish,
  disposeObject3D,
};
