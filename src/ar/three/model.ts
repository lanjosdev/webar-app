import {
  Group,
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
import {
  createProceduralGroundShadow,
  MODEL_GROUND_OFFSET,
} from '../../three/groundShadow';
import {ARError} from '../engine/arError';
import {
  createAutoRotationController,
  type AutoRotationController,
} from './autoRotation';

export const PLACEMENT_MODEL_URL = MODEL_ASSET_URL;
export const PLACEMENT_MODEL_MAX_DIMENSION = MODEL_ASSET_MAX_DIMENSION;
export const PLACEMENT_MODEL_GROUND_OFFSET = MODEL_GROUND_OFFSET;
export const PLACEMENT_MODEL_LOAD_TIMEOUT_MS = MODEL_ASSET_LOAD_TIMEOUT_MS;
export const PLACEMENT_MODEL_METALNESS = MODEL_ASSET_METALNESS;
export const PLACEMENT_MODEL_ROUGHNESS = MODEL_ASSET_ROUGHNESS;
export const PLACEMENT_MODEL_CREASE_ANGLE = MODEL_ASSET_CREASE_ANGLE;
export const PLACEMENT_SHADOW_OPACITY = 0.34;

const SHADOW_GROUND_CLEARANCE = 0.004;

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
  const shadow = createProceduralGroundShadow(asset.size, normalizedMaxDimension, {
    name: 'placement-logo-ground-shadow',
    opacity: PLACEMENT_SHADOW_OPACITY,
    positionY: -PLACEMENT_MODEL_GROUND_OFFSET + SHADOW_GROUND_CLEARANCE,
  });
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
