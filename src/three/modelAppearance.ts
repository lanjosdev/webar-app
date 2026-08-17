import {Mesh, MeshStandardMaterial, type Object3D} from 'three';

export type ModelColorId = 'silver' | 'graphite' | 'gold';
export type ModelFinishId = 'polished' | 'satin' | 'matte';

export interface ModelAppearanceConfig {
  color: ModelColorId;
  finish: ModelFinishId;
}

export interface ModelColorOption {
  readonly hex: string;
  readonly id: ModelColorId;
  readonly label: string;
}

export interface ModelFinishOption {
  readonly id: ModelFinishId;
  readonly label: string;
  readonly roughness: number;
}

export const MODEL_APPEARANCE_METALNESS = 0.88;

export const MODEL_COLOR_OPTIONS: readonly ModelColorOption[] = [
  {hex: '#FFFFFF', id: 'silver', label: 'Prata'},
  {hex: '#2F3237', id: 'graphite', label: 'Grafite'},
  {hex: '#D4AF37', id: 'gold', label: 'Dourado'},
];

export const MODEL_FINISH_OPTIONS: readonly ModelFinishOption[] = [
  {id: 'polished', label: 'Polido', roughness: 0.12},
  {id: 'satin', label: 'Acetinado', roughness: 0.3},
  {id: 'matte', label: 'Fosco', roughness: 0.55},
];

export const DEFAULT_MODEL_APPEARANCE: Readonly<ModelAppearanceConfig> =
  Object.freeze({color: 'silver', finish: 'polished'});

const COLOR_IDS = new Set<ModelColorId>(
  MODEL_COLOR_OPTIONS.map(({id}) => id),
);
const FINISH_IDS = new Set<ModelFinishId>(
  MODEL_FINISH_OPTIONS.map(({id}) => id),
);
const COLOR_BY_ID = new Map(
  MODEL_COLOR_OPTIONS.map((option) => [option.id, option]),
);
const FINISH_BY_ID = new Map(
  MODEL_FINISH_OPTIONS.map((option) => [option.id, option]),
);

export function normalizeModelAppearance(
  value?: Partial<ModelAppearanceConfig> | null,
): ModelAppearanceConfig {
  return {
    color: isModelColorId(value?.color)
      ? value.color
      : DEFAULT_MODEL_APPEARANCE.color,
    finish: isModelFinishId(value?.finish)
      ? value.finish
      : DEFAULT_MODEL_APPEARANCE.finish,
  };
}

export function parseModelAppearance(
  search: string | URLSearchParams,
): ModelAppearanceConfig {
  const parameters =
    typeof search === 'string' ? new URLSearchParams(search) : search;

  return normalizeModelAppearance({
    color: (parameters.get('c') as ModelColorId | null) ?? undefined,
    finish: (parameters.get('f') as ModelFinishId | null) ?? undefined,
  });
}

export function createModelAppearanceSearchParams(
  appearance: ModelAppearanceConfig,
): URLSearchParams {
  const normalized = normalizeModelAppearance(appearance);
  return new URLSearchParams({c: normalized.color, f: normalized.finish});
}

export function collectModelAppearanceMaterials(
  root: Object3D,
): MeshStandardMaterial[] {
  const materials = new Set<MeshStandardMaterial>();

  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    objectMaterials.forEach((material) => {
      if (material instanceof MeshStandardMaterial) {
        materials.add(material);
      }
    });
  });

  return [...materials];
}

export function applyModelAppearance(
  materials: Iterable<MeshStandardMaterial>,
  appearance: ModelAppearanceConfig,
): ModelAppearanceConfig {
  const normalized = normalizeModelAppearance(appearance);
  const color = COLOR_BY_ID.get(normalized.color);
  const finish = FINISH_BY_ID.get(normalized.finish);

  if (!color || !finish) {
    return normalizeModelAppearance();
  }

  for (const material of materials) {
    material.color.set(color.hex);
    material.metalness = MODEL_APPEARANCE_METALNESS;
    material.roughness = finish.roughness;
  }

  return normalized;
}

export function isModelColorId(value: unknown): value is ModelColorId {
  return typeof value === 'string' && COLOR_IDS.has(value as ModelColorId);
}

export function isModelFinishId(value: unknown): value is ModelFinishId {
  return typeof value === 'string' && FINISH_IDS.has(value as ModelFinishId);
}
