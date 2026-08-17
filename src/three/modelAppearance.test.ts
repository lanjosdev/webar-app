import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three';
import {describe, expect, it} from 'vitest';

import {
  applyModelAppearance,
  collectModelAppearanceMaterials,
  createModelAppearanceSearchParams,
  DEFAULT_MODEL_APPEARANCE,
  MODEL_APPEARANCE_METALNESS,
  normalizeModelAppearance,
  parseModelAppearance,
} from './modelAppearance';

describe('model appearance', () => {
  it('uses silver and polished as the default appearance', () => {
    expect(DEFAULT_MODEL_APPEARANCE).toEqual({
      color: 'silver',
      finish: 'polished',
    });
    expect(normalizeModelAppearance()).toEqual(DEFAULT_MODEL_APPEARANCE);
  });

  it('accepts allowlisted query values and rejects unsupported values', () => {
    expect(parseModelAppearance('?c=gold&f=matte&debug=1')).toEqual({
      color: 'gold',
      finish: 'matte',
    });
    expect(parseModelAppearance('?c=red&f=mirror')).toEqual(
      DEFAULT_MODEL_APPEARANCE,
    );
  });

  it('serializes only the two appearance parameters', () => {
    expect(
      createModelAppearanceSearchParams({color: 'graphite', finish: 'satin'})
        .toString(),
    ).toBe('c=graphite&f=satin');
  });

  it('collects unique standard materials from single and material-array meshes', () => {
    const root = new Group();
    const shared = new MeshStandardMaterial();
    const second = new MeshStandardMaterial();
    const incompatible = new MeshBasicMaterial();
    root.add(
      new Mesh(new BoxGeometry(), shared),
      new Mesh(new BoxGeometry(), [shared, second, incompatible]),
    );

    expect(collectModelAppearanceMaterials(root)).toEqual([shared, second]);
  });

  it('updates uniforms in place without creating or replacing materials', () => {
    const material = new MeshStandardMaterial();
    const materials = [material];

    applyModelAppearance(materials, {color: 'gold', finish: 'matte'});

    expect(materials[0]).toBe(material);
    expect(`#${material.color.getHexString()}`.toUpperCase()).toBe('#D4AF37');
    expect(material.metalness).toBe(MODEL_APPEARANCE_METALNESS);
    expect(material.roughness).toBe(0.55);
  });
});
