import {MeshBasicMaterial, Vector3} from 'three';
import {describe, expect, it} from 'vitest';

import {
  createProceduralGroundShadow,
  MODEL_GROUND_OFFSET,
  PROCEDURAL_GROUND_SHADOW_TEXTURE_SIZE,
} from './groundShadow';

describe('createProceduralGroundShadow', () => {
  it('keeps the showroom and AR model at the same ground offset', () => {
    expect(MODEL_GROUND_OFFSET).toBe(0.15);
  });

  it('creates the shared lightweight shadow used by AR and showroom scenes', () => {
    const shadow = createProceduralGroundShadow(new Vector3(1, 1, 0.2), 1, {
      name: 'test-ground-shadow',
      opacity: 0.34,
      positionY: 0.004,
    });
    const material = shadow.material as MeshBasicMaterial;
    const image = material.map?.image as {height: number; width: number};

    expect(shadow.name).toBe('test-ground-shadow');
    expect(shadow.position.y).toBeCloseTo(0.004);
    expect(material.opacity).toBe(0.34);
    expect(material.depthWrite).toBe(false);
    expect(image.width).toBe(PROCEDURAL_GROUND_SHADOW_TEXTURE_SIZE);
    expect(image.height).toBe(PROCEDURAL_GROUND_SHADOW_TEXTURE_SIZE);

    shadow.geometry.dispose();
    material.map?.dispose();
    material.dispose();
  });
});
