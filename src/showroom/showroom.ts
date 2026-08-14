import {
  ACESFilmicToneMapping,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RGBAFormat,
  Scene,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
  WebGLRenderer,
} from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

import {disposeObject3D, loadModelAsset} from '../three/modelAsset';
import {createShowroomControls} from './controls';
import type {ShowroomSession} from './showroomTypes';

const ENVIRONMENT_MAP_SIZE = 128;
const MAX_PIXEL_RATIO = 1.5;
const AUTO_ROTATION_DURATION_MS = 12_000;
const ENTRANCE_DURATION_MS = 900;
const MAX_DELTA_SECONDS = 0.1;
const SHADOW_TEXTURE_SIZE = 64;
const CAMERA_POSITION = new Vector3(0, 0.72, 2.4);
const CAMERA_TARGET = new Vector3(0, 0.45, 0);

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
  const backgroundTexture = createBackgroundTexture();
  scene.background = backgroundTexture;
  const camera = new PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.copy(CAMERA_POSITION);

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

  const stage = createGalleryStage();
  const modelPresentation = new Group();
  modelPresentation.name = 'showroom-model-presentation';
  modelPresentation.position.y = 0.085;
  modelPresentation.add(asset.root);
  stage.add(modelPresentation);
  scene.add(stage);

  const controls = createShowroomControls(camera, canvas, CAMERA_TARGET);
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
      backgroundTexture.dispose();
      disposeObject3D(stage);
      stage.removeFromParent();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

function createGalleryStage(): Group {
  const stage = new Group();
  stage.name = 'showroom-gallery-stage';

  const floorMaterial = new MeshStandardMaterial({
    color: 0x1b1b1b,
    metalness: 0.2,
    roughness: 0.84,
  });
  const floor = new Mesh(new PlaneGeometry(8, 8), floorMaterial);
  floor.name = 'showroom-floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.005;

  const platformMaterial = new MeshStandardMaterial({
    color: 0x252525,
    metalness: 0.58,
    roughness: 0.32,
  });
  const platform = new Mesh(
    new CylinderGeometry(1.08, 1.16, 0.08, 48),
    platformMaterial,
  );
  platform.name = 'showroom-platform';
  platform.position.y = 0.035;

  const shadowTexture = createRadialShadowTexture();
  const shadow = new Mesh(
    new PlaneGeometry(0.92, 0.42),
    new MeshBasicMaterial({
      color: 0x000000,
      depthWrite: false,
      map: shadowTexture,
      opacity: 0.45,
      toneMapped: false,
      transparent: true,
    }),
  );
  shadow.name = 'showroom-contact-shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.078;

  const grid = new GridHelper(8, 32, 0x3a3a3a, 0x242424);
  grid.name = 'showroom-grid';
  grid.position.y = 0.001;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  gridMaterials.forEach((material) => {
    material.opacity = 0.32;
    material.transparent = true;
  });

  const hemisphereLight = new HemisphereLight(0xffffff, 0x111722, 0.76);
  const keyLight = new DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(1.8, 3, 2.2);
  const rimLight = new DirectionalLight(0xbfc6d2, 0.56);
  rimLight.position.set(-2, 1.5, -1.2);

  stage.add(
    floor,
    grid,
    platform,
    shadow,
    hemisphereLight,
    keyLight,
    rimLight,
  );

  return stage;
}

function createBackgroundTexture(): DataTexture {
  const width = 128;
  const height = 96;
  const pixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const progressX = x / (width - 1);
      const progressY = y / (height - 1);
      const centerGlow = Math.max(0, 1 - Math.abs(progressY - 0.42) * 2.4);
      const horizontalGlow = Math.max(0, 1 - Math.abs(progressX - 0.5) * 1.65);
      const leftPanel = Math.exp(-(((progressX - 0.19) / 0.012) ** 2));
      const rightPanel = Math.exp(-(((progressX - 0.81) / 0.012) ** 2));
      const panelFade = Math.max(0, 1 - Math.abs(progressY - 0.43) * 1.55);
      const panelGlow = (leftPanel + rightPanel) * panelFade * 54;
      const value = Math.min(
        104,
        Math.round(
          14 + centerGlow * 14 + horizontalGlow * 5 + progressY * 3 + panelGlow,
        ),
      );
      const offset = (y * width + x) * 4;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }

  const texture = new DataTexture(
    pixels,
    width,
    height,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return texture;
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
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return texture;
}
