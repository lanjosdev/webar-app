import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

import {disposeObject3D, loadModelAsset} from '../three/modelAsset';
import {
  createProceduralGroundShadow,
  MODEL_GROUND_OFFSET,
} from '../three/groundShadow';
import {createShowroomControls} from './controls';
import type {ShowroomSession} from './showroomTypes';

const ENVIRONMENT_MAP_SIZE = 128;
const MAX_PIXEL_RATIO = 1.5;
const AUTO_ROTATION_DURATION_MS = 12_000;
const ENTRANCE_DURATION_MS = 900;
const MAX_DELTA_SECONDS = 0.1;
const FLOOR_CLEARANCE = 0.004;
const CAMERA_DISTANCE = 2.4;
const CAMERA_HEIGHT_ABOVE_TARGET = 0.27;

interface CreateShowroomOptions {
  onInteraction?: () => void;
}

export async function createShowroomSession(
  canvas: HTMLCanvasElement,
  options: CreateShowroomOptions = {},
): Promise<ShowroomSession> {
  const asset = await loadModelAsset();
  let renderer: WebGLRenderer | undefined;

  try {
    renderer = new WebGLRenderer({
      alpha: false,
      antialias: true,
      canvas,
      powerPreference: 'default',
    });
  } catch (error: unknown) {
    asset.dispose();
    throw new Error('Não foi possível iniciar a visualização 3D.', {cause: error});
  }

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));

  const scene = new Scene();
  scene.background = new Color(0x000000);
  const cameraTarget = new Vector3(
    0,
    MODEL_GROUND_OFFSET + asset.size.y * 0.5,
    0,
  );
  const camera = new PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.set(
    0,
    cameraTarget.y + CAMERA_HEIGHT_ABOVE_TARGET,
    CAMERA_DISTANCE,
  );

  const roomEnvironment = new RoomEnvironment();
  const pmremGenerator = new PMREMGenerator(renderer);
  const environmentTarget = pmremGenerator.fromScene(
    roomEnvironment,
    0.04,
    0.1,
    20,
    {size: ENVIRONMENT_MAP_SIZE},
  );
  roomEnvironment.dispose();
  pmremGenerator.dispose();
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 0.5;

  const stage = createMinimalStage(asset.size);
  const modelPresentation = new Group();
  modelPresentation.name = 'showroom-model-presentation';
  modelPresentation.position.y = MODEL_GROUND_OFFSET;
  modelPresentation.add(asset.root);
  stage.add(modelPresentation);
  scene.add(stage);

  const controls = createShowroomControls(camera, canvas, cameraTarget);
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionPreference.matches;
  let autoRotate = !reducedMotion;
  let autoRotateRemainingMs = AUTO_ROTATION_DURATION_MS;
  let autoRotateDeadline = performance.now() + autoRotateRemainingMs;
  let entranceStartedAt = performance.now();
  let entranceActive = !reducedMotion;
  let interacted = false;
  let paused = false;
  let disposed = false;
  let frameId: number | undefined;
  let previousFrameAt = performance.now();

  controls.autoRotate = autoRotate;
  if (entranceActive) {
    modelPresentation.rotation.y = -0.28;
    modelPresentation.scale.setScalar(0.96);
  }

  const renderFrame = (now: number): void => {
    frameId = undefined;
    if (disposed || paused) {
      return;
    }

    const deltaSeconds = Math.min(
      MAX_DELTA_SECONDS,
      Math.max(0, (now - previousFrameAt) / 1000),
    );
    previousFrameAt = now;

    if (autoRotate && now >= autoRotateDeadline) {
      autoRotate = false;
      autoRotateRemainingMs = 0;
      controls.autoRotate = false;
    }

    if (entranceActive) {
      const progress = Math.min(1, (now - entranceStartedAt) / ENTRANCE_DURATION_MS);
      const eased = 1 - (1 - progress) ** 3;
      modelPresentation.rotation.y = -0.28 * (1 - eased);
      modelPresentation.scale.setScalar(0.96 + eased * 0.04);
      entranceActive = progress < 1;
    }

    const controlsChanged = controls.update(deltaSeconds);
    renderer.render(scene, camera);

    if (autoRotate || entranceActive || controlsChanged) {
      requestFrame();
    }
  };

  const requestFrame = (): void => {
    if (disposed || paused || frameId !== undefined) {
      return;
    }

    frameId = requestAnimationFrame(renderFrame);
  };

  const resize = (): void => {
    if (disposed) {
      return;
    }

    const width = Math.max(1, canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestFrame();
  };

  const stopAutoRotation = (): void => {
    if (!autoRotate && interacted) {
      return;
    }

    interacted = true;
    autoRotate = false;
    autoRotateRemainingMs = 0;
    controls.autoRotate = false;
    options.onInteraction?.();
    requestFrame();
  };

  const handleMotionPreferenceChange = (event: MediaQueryListEvent): void => {
    reducedMotion = event.matches;
    if (reducedMotion) {
      entranceActive = false;
      modelPresentation.rotation.y = 0;
      modelPresentation.scale.setScalar(1);
      autoRotate = false;
      autoRotateRemainingMs = 0;
      controls.autoRotate = false;
    }
    requestFrame();
  };

  const handleControlsChange = (): void => requestFrame();
  const handleControlsStart = (): void => stopAutoRotation();
  const handleWindowResize = (): void => resize();
  const resizeObserver =
    typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : undefined;

  controls.addEventListener('change', handleControlsChange);
  controls.addEventListener('start', handleControlsStart);
  motionPreference.addEventListener('change', handleMotionPreferenceChange);
  resizeObserver?.observe(canvas);
  window.addEventListener('resize', handleWindowResize, {passive: true});

  resize();
  requestFrame();

  return {
    pause(): void {
      if (disposed || paused) {
        return;
      }

      paused = true;
      controls.enabled = false;
      if (autoRotate) {
        autoRotateRemainingMs = Math.max(0, autoRotateDeadline - performance.now());
      }
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
        frameId = undefined;
      }
    },

    resetView(): void {
      if (disposed) {
        return;
      }

      stopAutoRotation();
      controls.reset();
      requestFrame();
    },

    resume(): void {
      if (disposed || !paused) {
        return;
      }

      paused = false;
      controls.enabled = true;
      previousFrameAt = performance.now();
      if (autoRotate && autoRotateRemainingMs > 0) {
        autoRotateDeadline = performance.now() + autoRotateRemainingMs;
      }
      resize();
      requestFrame();
    },

    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      controls.removeEventListener('change', handleControlsChange);
      controls.removeEventListener('start', handleControlsStart);
      controls.dispose();
      motionPreference.removeEventListener('change', handleMotionPreferenceChange);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
        frameId = undefined;
      }
      asset.dispose();
      scene.environment = null;
      environmentTarget.dispose();
      disposeObject3D(stage);
      stage.removeFromParent();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

function createMinimalStage(modelSize: Vector3): Group {
  const stage = new Group();
  stage.name = 'showroom-minimal-stage';

  const floor = new Mesh(
    new PlaneGeometry(10, 10),
    new MeshStandardMaterial({
      color: 0x070707,
      metalness: 0,
      roughness: 0.96,
    }),
  );
  floor.name = 'showroom-spotlit-floor';
  floor.rotation.x = -Math.PI / 2;

  const normalizedMaxDimension = Math.max(modelSize.x, modelSize.y, modelSize.z);
  const shadow = createProceduralGroundShadow(modelSize, normalizedMaxDimension, {
    name: 'showroom-model-ground-shadow',
    opacity: 0.34,
    positionY: FLOOR_CLEARANCE,
  });

  const hemisphereLight = new HemisphereLight(0xffffff, 0x000000, 0.16);
  const keyLight = new SpotLight(
    0xffffff,
    90,
    8,
    Math.PI * 0.19,
    0.82,
    2,
  );
  keyLight.name = 'showroom-center-spotlight';
  keyLight.position.set(0, 3.2, 1.35);
  keyLight.target.position.set(0, 0, 0);
  const rimLight = new DirectionalLight(0xbfc6d2, 0.48);
  rimLight.position.set(-2.2, 1.4, -1.6);

  stage.add(floor, shadow, hemisphereLight, keyLight, keyLight.target, rimLight);

  return stage;
}
