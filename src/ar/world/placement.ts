import {
  DoubleSide,
  type Camera,
  type Intersection,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  type Scene,
  Vector2,
  Vector3,
} from 'three';

const GROUND_SIZE = 100;
const MAX_PLACEMENT_DISTANCE = 20;
const RETICLE_GROUND_OFFSET = 0.004;
const RETICLE_INNER_RADIUS = 0.08;
const RETICLE_OUTER_RADIUS = 0.12;

export interface GroundPlacementController {
  dispose(): void;
  setEnabled(enabled: boolean): void;
  update(): void;
}

interface GroundPlacementOptions {
  camera: Camera;
  canvas: HTMLCanvasElement;
  onPlaced(): void;
  scene: Scene;
  target: Object3D;
  targetBaseOffset: number;
}

/**
 * Places one object on the horizontal World Tracking ground plane at Y = 0.
 *
 * Technique: THREE.Raycaster against an invisible PlaneGeometry, following the
 * official 8th Wall three.js "Tap to place" example. This is a virtual surface
 * for the single ground plane, not WebXR hit testing or multi-plane detection.
 * Sources consulted: 8th Wall World guide, official placeground example, and
 * Three.js Raycaster documentation on 2026-08-10.
 */
export function createGroundPlacementController({
  camera,
  canvas,
  onPlaced,
  scene,
  target,
  targetBaseOffset,
}: GroundPlacementOptions): GroundPlacementController {
  const groundGeometry = new PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
  const groundMaterial = new MeshBasicMaterial({
    opacity: 0,
    side: DoubleSide,
    transparent: true,
  });
  groundMaterial.colorWrite = false;
  groundMaterial.depthWrite = false;

  const ground = new Mesh(groundGeometry, groundMaterial);
  ground.name = 'placement-ground-surface';
  ground.rotation.x = -Math.PI / 2;

  const reticleGeometry = new RingGeometry(
    RETICLE_INNER_RADIUS,
    RETICLE_OUTER_RADIUS,
    32,
  );
  const reticleMaterial = new MeshBasicMaterial({
    color: 0x35d0ba,
    depthTest: false,
    depthWrite: false,
    opacity: 0.9,
    side: DoubleSide,
    transparent: true,
  });
  const reticle = new Mesh(reticleGeometry, reticleMaterial);
  reticle.name = 'placement-reticle';
  reticle.rotation.x = -Math.PI / 2;
  reticle.renderOrder = 1;
  reticle.visible = false;

  scene.add(ground, reticle);

  const center = new Vector2(0, 0);
  const intersections: Intersection[] = [];
  const placementPoint = new Vector3();
  const raycaster = new Raycaster();
  raycaster.far = MAX_PLACEMENT_DISTANCE;
  let enabled = false;
  let hasValidPlacement = false;

  const handlePointerUp = (event: PointerEvent): void => {
    if (
      !enabled ||
      !hasValidPlacement ||
      !event.isPrimary ||
      event.button !== 0
    ) {
      return;
    }

    target.position.copy(placementPoint);
    target.position.y += targetBaseOffset;
    target.visible = true;
    onPlaced();
  };

  canvas.addEventListener('pointerup', handlePointerUp);

  return {
    dispose(): void {
      canvas.removeEventListener('pointerup', handlePointerUp);
      scene.remove(ground, reticle);
      groundGeometry.dispose();
      groundMaterial.dispose();
      reticleGeometry.dispose();
      reticleMaterial.dispose();
    },

    setEnabled(nextEnabled): void {
      enabled = nextEnabled;

      if (!enabled) {
        hasValidPlacement = false;
        reticle.visible = false;
      }
    },

    update(): void {
      if (!enabled) {
        return;
      }

      intersections.length = 0;
      raycaster.setFromCamera(center, camera);
      raycaster.intersectObject(ground, false, intersections);

      const intersection = intersections[0];
      hasValidPlacement = intersection !== undefined;
      reticle.visible = hasValidPlacement;

      if (!intersection) {
        return;
      }

      placementPoint.copy(intersection.point);
      reticle.position.copy(placementPoint);
      reticle.position.y += RETICLE_GROUND_OFFSET;
    },
  };
}
