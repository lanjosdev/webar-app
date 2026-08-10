import {
  DoubleSide,
  type Camera,
  type Intersection,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  PlaneGeometry,
  Raycaster,
  type Scene,
  Vector2,
  Vector3,
  Vector4,
  type WebGLRenderer,
} from 'three';

const GROUND_SIZE = 100;
const MAX_PLACEMENT_DISTANCE = 20;
const RETICLE_WORLD_RADIUS = 0.12;
const RETICLE_BASE_DIAMETER_PX = 56;
const RETICLE_MIN_DIAMETER_PX = 40;
const RETICLE_MAX_DIAMETER_PX = 96;
const RETICLE_MIN_ASPECT_RATIO = 0.18;
const RETICLE_TRANSFORM_EPSILON = 0.005;

export interface GroundPlacementController {
  dispose(): void;
  reset(): void;
  setEnabled(enabled: boolean): void;
}

interface GroundPlacementOptions {
  canvas: HTMLCanvasElement;
  onPlaced(): void;
  reticleElement: HTMLElement;
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
  canvas,
  onPlaced,
  reticleElement,
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

  scene.add(ground);

  const center = new Vector2(0, 0);
  const intersections: Intersection[] = [];
  const placementPoint = new Vector3();
  const targetWorldPosition = new Vector3();
  const projectedXNegative = new Vector3();
  const projectedXPositive = new Vector3();
  const projectedZNegative = new Vector3();
  const projectedZPositive = new Vector3();
  const renderViewport = new Vector4();
  const raycaster = new Raycaster();
  raycaster.far = MAX_PLACEMENT_DISTANCE;
  let enabled = false;
  let hasValidPlacement = false;
  let isReticleVisible = false;
  let placementRequested = false;
  let drawingBufferHeight = 0;
  let drawingBufferWidth = 0;
  let lastReticleRotation = Number.NaN;
  let lastReticleScaleX = Number.NaN;
  let lastReticleScaleY = Number.NaN;

  const setReticleVisible = (visible: boolean): void => {
    if (isReticleVisible === visible) {
      return;
    }

    isReticleVisible = visible;
    reticleElement.hidden = !visible;
    reticleElement.setAttribute('aria-hidden', String(!visible));
  };

  // The visual reticle is intentionally screen-space UI. A world-space mesh
  // is affected by the XR camera projection and cannot guarantee a fixed
  // visual position in the viewport across devices.
  reticleElement.hidden = true;
  reticleElement.setAttribute('aria-hidden', 'true');

  const updateRenderViewport = (renderer: WebGLRenderer): boolean => {
    const gl = renderer.getContext();
    const viewport = gl.getParameter(gl.VIEWPORT) as Int32Array;

    // XR8 changes the shared WebGL viewport between pipeline passes without
    // necessarily resizing the drawing buffer. Read the actual GL state on
    // every render boundary instead of caching by buffer dimensions.
    drawingBufferWidth = gl.drawingBufferWidth;
    drawingBufferHeight = gl.drawingBufferHeight;
    renderViewport.set(
      viewport[0] ?? 0,
      viewport[1] ?? 0,
      viewport[2] ?? 0,
      viewport[3] ?? 0,
    );

    return drawingBufferWidth > 0 &&
      drawingBufferHeight > 0 &&
      renderViewport.z > 0 &&
      renderViewport.w > 0;
  };

  const updateReticleProjection = (
    renderCamera: Camera,
    viewportWidth: number,
    viewportHeight: number,
  ): void => {

    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }

    // Project two diameters of the original horizontal 3D ring. Their
    // screen-space basis describes the ellipse produced by the current camera
    // inclination, while the DOM element itself remains anchored at 50%/50%.
    projectedXNegative
      .set(
        placementPoint.x - RETICLE_WORLD_RADIUS,
        placementPoint.y,
        placementPoint.z,
      )
      .project(renderCamera);
    projectedXPositive
      .set(
        placementPoint.x + RETICLE_WORLD_RADIUS,
        placementPoint.y,
        placementPoint.z,
      )
      .project(renderCamera);
    projectedZNegative
      .set(
        placementPoint.x,
        placementPoint.y,
        placementPoint.z - RETICLE_WORLD_RADIUS,
      )
      .project(renderCamera);
    projectedZPositive
      .set(
        placementPoint.x,
        placementPoint.y,
        placementPoint.z + RETICLE_WORLD_RADIUS,
      )
      .project(renderCamera);

    const xAxisX = (projectedXPositive.x - projectedXNegative.x) * viewportWidth / 4;
    const xAxisY = -(projectedXPositive.y - projectedXNegative.y) * viewportHeight / 4;
    const zAxisX = (projectedZPositive.x - projectedZNegative.x) * viewportWidth / 4;
    const zAxisY = -(projectedZPositive.y - projectedZNegative.y) * viewportHeight / 4;

    // Singular values of the projected ground basis are the ellipse's major
    // and minor radii. The major eigenvector supplies its screen rotation.
    const covarianceXX = xAxisX * xAxisX + zAxisX * zAxisX;
    const covarianceXY = xAxisX * xAxisY + zAxisX * zAxisY;
    const covarianceYY = xAxisY * xAxisY + zAxisY * zAxisY;
    const trace = covarianceXX + covarianceYY;
    const discriminant = Math.sqrt(
      Math.max(
        0,
        (covarianceXX - covarianceYY) ** 2 + 4 * covarianceXY ** 2,
      ),
    );
    const majorRadius = Math.sqrt(Math.max(0, (trace + discriminant) / 2));
    const minorRadius = Math.sqrt(Math.max(0, (trace - discriminant) / 2));

    if (!Number.isFinite(majorRadius) || majorRadius <= 0) {
      return;
    }

    const diameter = Math.min(
      RETICLE_MAX_DIAMETER_PX,
      Math.max(RETICLE_MIN_DIAMETER_PX, majorRadius * 2),
    );
    const aspectRatio = Math.min(
      1,
      Math.max(RETICLE_MIN_ASPECT_RATIO, minorRadius / majorRadius),
    );
    const rotation = 0.5 * Math.atan2(
      2 * covarianceXY,
      covarianceXX - covarianceYY,
    );
    const scaleX = diameter / RETICLE_BASE_DIAMETER_PX;
    const scaleY = diameter * aspectRatio / RETICLE_BASE_DIAMETER_PX;

    if (
      Math.abs(rotation - lastReticleRotation) < RETICLE_TRANSFORM_EPSILON &&
      Math.abs(scaleX - lastReticleScaleX) < RETICLE_TRANSFORM_EPSILON &&
      Math.abs(scaleY - lastReticleScaleY) < RETICLE_TRANSFORM_EPSILON
    ) {
      return;
    }

    lastReticleRotation = rotation;
    lastReticleScaleX = scaleX;
    lastReticleScaleY = scaleY;
    reticleElement.style.transform =
      `rotate(${rotation}rad) scale(${scaleX}, ${scaleY})`;
  };

  const updatePlacement = (
    renderer: WebGLRenderer,
    renderCamera: Camera,
  ): void => {
    if (!enabled) {
      return;
    }

    // Scene.onBeforeRender provides the exact camera that Three.js will use
    // for this frame. XR8 drives its pose and intrinsics during the pipeline;
    // update the derived matrices required by Raycaster at this final boundary.
    renderCamera.updateMatrixWorld(true);
    renderCamera.projectionMatrixInverse
      .copy(renderCamera.projectionMatrix)
      .invert();

    if (!updateRenderViewport(renderer)) {
      hasValidPlacement = false;
      setReticleVisible(false);
      return;
    }

    // Convert the visual center of the full canvas into the NDC space of the
    // viewport currently used by XR8. A fixed (0, 0) only works when that
    // viewport fills the drawing buffer without an offset or cover crop.
    center.set(
      ((drawingBufferWidth / 2 - renderViewport.x) / renderViewport.z) * 2 - 1,
      ((drawingBufferHeight / 2 - renderViewport.y) / renderViewport.w) * 2 - 1,
    );

    intersections.length = 0;
    raycaster.setFromCamera(center, renderCamera);
    raycaster.intersectObject(ground, false, intersections);

    const intersection = intersections[0];
    if (!intersection) {
      hasValidPlacement = false;
      placementRequested = false;
      setReticleVisible(false);
      return;
    }

    hasValidPlacement = true;
    placementPoint.copy(intersection.point);
    updateReticleProjection(
      renderCamera,
      renderViewport.z * canvas.clientWidth / drawingBufferWidth,
      renderViewport.w * canvas.clientHeight / drawingBufferHeight,
    );
    setReticleVisible(true);

    if (placementRequested) {
      placementRequested = false;
      targetWorldPosition.copy(placementPoint);
      targetWorldPosition.y += targetBaseOffset;

      if (target.parent) {
        // Intersection.point is world-space, while Object3D.position is local
        // to its parent. XR8 owns the scene hierarchy, so do not assume that
        // the scene/content matrices remain identity transforms.
        target.parent.updateWorldMatrix(true, false);
        target.position.copy(targetWorldPosition);
        target.parent.worldToLocal(target.position);
      } else {
        target.position.copy(targetWorldPosition);
      }
      target.visible = true;

      // WebGLRenderer updated the scene graph before Scene.onBeforeRender.
      // Commit this late transform so the first visible frame uses the exact
      // camera pose and intersection that produced the placement point.
      target.updateMatrixWorld(true);
      onPlaced();
    }
  };

  const previousOnBeforeRender = scene.onBeforeRender;
  const handleBeforeRender: Scene['onBeforeRender'] = (...args) => {
    previousOnBeforeRender.call(scene, ...args);
    updatePlacement(args[0], args[2]);
  };
  scene.onBeforeRender = handleBeforeRender;

  const handlePointerUp = (event: PointerEvent): void => {
    if (
      !enabled ||
      !hasValidPlacement ||
      !event.isPrimary ||
      event.button !== 0
    ) {
      return;
    }

    // Defer placement to Scene.onBeforeRender. Reusing a point from the
    // preceding frame can visibly miss the reticle when the tracked camera
    // pose changes between pointerup and the next render.
    placementRequested = true;
  };

  canvas.addEventListener('pointerup', handlePointerUp);

  return {
    dispose(): void {
      canvas.removeEventListener('pointerup', handlePointerUp);
      if (scene.onBeforeRender === handleBeforeRender) {
        scene.onBeforeRender = previousOnBeforeRender;
      }
      setReticleVisible(false);
      reticleElement.style.removeProperty('transform');
      scene.remove(ground);
      groundGeometry.dispose();
      groundMaterial.dispose();
    },

    reset(): void {
      placementRequested = false;
      hasValidPlacement = false;
      target.visible = false;
      setReticleVisible(false);
    },

    setEnabled(nextEnabled): void {
      if (enabled === nextEnabled) {
        return;
      }

      enabled = nextEnabled;

      if (!enabled) {
        hasValidPlacement = false;
        placementRequested = false;
        setReticleVisible(false);
      }
    },
  };
}
