import {
  DataTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';

export const PROCEDURAL_GROUND_SHADOW_TEXTURE_SIZE = 64;
export const MODEL_GROUND_OFFSET = 0.15;

const SHADOW_WIDTH_RATIO = 0.88;
const SHADOW_DEPTH_RATIO = 0.3;

interface CreateProceduralGroundShadowOptions {
  name: string;
  opacity: number;
  positionY: number;
}

export function createProceduralGroundShadow(
  modelSize: Vector3,
  normalizedMaxDimension: number,
  options: CreateProceduralGroundShadowOptions,
): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const width = Math.max(
    modelSize.x * SHADOW_WIDTH_RATIO,
    normalizedMaxDimension * 0.4,
  );
  const depth = Math.max(
    modelSize.z * 1.25,
    normalizedMaxDimension * SHADOW_DEPTH_RATIO,
  );
  const texture = createRadialShadowTexture(`${options.name}-texture`);
  const material = new MeshBasicMaterial({
    color: 0x000000,
    depthWrite: false,
    map: texture,
    opacity: options.opacity,
    toneMapped: false,
    transparent: true,
  });
  const shadow = new Mesh(new PlaneGeometry(width, depth), material);
  shadow.name = options.name;
  shadow.position.y = options.positionY;
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 1;

  return shadow;
}

function createRadialShadowTexture(name: string): DataTexture {
  const size = PROCEDURAL_GROUND_SHADOW_TEXTURE_SIZE;
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const normalizedX = ((x + 0.5) / size) * 2 - 1;
      const normalizedY = ((y + 0.5) / size) * 2 - 1;
      const radius = Math.sqrt(normalizedX ** 2 + normalizedY ** 2);
      const falloff = Math.max(0, 1 - radius);
      const alpha = Math.round(falloff * falloff * 255);
      const offset = (y * size + x) * 4;

      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = alpha;
    }
  }

  const texture = new DataTexture(pixels, size, size);
  texture.name = name;
  texture.generateMipmaps = false;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;

  return texture;
}
