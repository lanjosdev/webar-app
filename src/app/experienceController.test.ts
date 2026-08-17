import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import type {ARAvailability} from '../ar/engine/availability';
import type {ARExperience} from '../ar/arExperience';
import type {ShowroomSession} from '../showroom/showroomTypes';
import type {HomeUI} from '../ui/home';
import type {MotionPermissionUI} from '../ui/motionPermission';
import type {ModelAppearanceConfig} from '../three/modelAppearance';

interface TestUI extends HomeUI {
  changeAppearance(appearance: ModelAppearanceConfig): void;
  customize(open: boolean): void;
  enter(): void;
  reset(): void;
  restoreAppearance(): void;
  retry(): void;
}

interface TestMotionUI extends MotionPermissionUI {
  cancel(): void;
  confirm(): Promise<void>;
}

beforeEach(() => {
  const elements: Record<string, object> = {
    app: {dataset: {}},
    'camera-feed': {
      hidden: false,
      removeAttribute: vi.fn(),
      setAttribute: vi.fn(),
    },
    'status-panel': {
      hidden: false,
      removeAttribute: vi.fn(),
      setAttribute: vi.fn(),
    },
  };
  vi.stubGlobal('document', {
    getElementById: vi.fn((id: string) => elements[id] ?? null),
    visibilityState: 'visible',
  });
  vi.stubGlobal('window', {
    XR8: {},
    addEventListener: vi.fn(),
    isSecureContext: true,
    location: {search: ''},
    matchMedia: vi.fn(() => ({matches: false})),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('ExperienceController', () => {
  it('keeps model interaction locked until the showroom entrance completes', async () => {
    let resolveEntrance: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      resolveEntrance = resolve;
    });
    const home = createHomeMock();
    const showroom = {...createShowroomMock([]), ready};
    const {createExperienceController} = await import('./experienceController');
    const controller = createExperienceController({
      checkAvailability: async () => ({status: 'available'}),
      createHome: () => home,
      createMotionPermission: () => createMotionMock(),
      createShowroom: async () => showroom,
    });

    controller.start();
    await flushPromises();

    expect(home.setPhase).toHaveBeenCalledWith('entering');
    expect(home.setPhase).not.toHaveBeenCalledWith('ready');

    resolveEntrance?.();
    await flushPromises();

    expect(home.setPhase).toHaveBeenCalledWith('ready');
    controller.destroy();
  });

  it('disposes the preview before starting one AR session', async () => {
    const actions: string[] = [];
    const home = createHomeMock();
    const motion = createMotionMock();
    const showroom = createShowroomMock(actions);
    const ar = createARMock(actions);
    const {createExperienceController} = await import('./experienceController');
    const controller = createExperienceController({
      checkAvailability: async () => ({status: 'available'}),
      createHome: () => home,
      createMotionPermission: () => motion,
      createShowroom: async () => showroom,
      loadARExperience: async () => ({createARExperience: async () => ar}),
      needsMotionPermission: () => false,
      waitForHandoff: async () => undefined,
    });

    controller.start();
    await flushPromises();
    home.enter();
    home.enter();
    await flushPromises();

    expect(actions.filter((action) => action === 'showroom:dispose')).toHaveLength(1);
    expect(actions.filter((action) => action === 'ar:start')).toHaveLength(1);
    expect(actions.indexOf('showroom:dispose')).toBeLessThan(
      actions.indexOf('ar:start'),
    );
    expect(controller.mode).toBe('ar');

    controller.destroy();
  });

  it('keeps the showroom active when motion permission is cancelled', async () => {
    const actions: string[] = [];
    const home = createHomeMock();
    const motion = createMotionMock();
    const showroom = createShowroomMock(actions);
    const loadARExperience = vi.fn();
    const {createExperienceController} = await import('./experienceController');
    const controller = createExperienceController({
      checkAvailability: async () => ({status: 'available'}),
      createHome: () => home,
      createMotionPermission: () => motion,
      createShowroom: async () => showroom,
      loadARExperience,
      needsMotionPermission: () => true,
    });

    controller.start();
    await flushPromises();
    home.enter();
    motion.cancel();

    expect(actions).toContain('showroom:pause');
    expect(actions).toContain('showroom:resume');
    expect(home.setBusy).toHaveBeenLastCalledWith(false);
    expect(loadARExperience).not.toHaveBeenCalled();
    expect(controller.mode).toBe('showroom');

    controller.destroy();
  });

  it('parses the appearance once and hands an immutable snapshot to AR', async () => {
    vi.stubGlobal('window', {
      XR8: {},
      addEventListener: vi.fn(),
      isSecureContext: true,
      location: {search: '?c=gold&f=matte&ignored=value'},
      matchMedia: vi.fn(() => ({matches: false})),
    });
    const home = createHomeMock();
    const showroom = createShowroomMock([]);
    let receivedAppearance: ModelAppearanceConfig | undefined;
    const ar = createARMock([]);
    const {createExperienceController} = await import('./experienceController');
    const controller = createExperienceController({
      checkAvailability: async () => ({status: 'available'}),
      createHome: () => home,
      createMotionPermission: () => createMotionMock(),
      createShowroom: async (_canvas, options) => {
        receivedAppearance = options.appearance;
        return showroom;
      },
      loadARExperience: async () => ({
        createARExperience: async ({appearance}) => {
          receivedAppearance = appearance;
          expect(Object.isFrozen(appearance)).toBe(true);
          return ar;
        },
      }),
      needsMotionPermission: () => false,
      waitForHandoff: async () => undefined,
    });

    controller.start();
    await flushPromises();
    expect(receivedAppearance).toEqual({color: 'gold', finish: 'matte'});
    expect(home.setAppearance).toHaveBeenCalledWith({
      color: 'gold',
      finish: 'matte',
    });

    home.enter();
    await flushPromises();

    expect(receivedAppearance).toEqual({color: 'gold', finish: 'matte'});
    controller.destroy();
  });

  it('never enters AR when compatibility reports a desktop device', async () => {
    const home = createHomeMock();
    const motion = createMotionMock();
    const loadARExperience = vi.fn();
    const unavailable: ARAvailability = {
      reason: 'mobile-required',
      status: 'unavailable',
    };
    const {createExperienceController} = await import('./experienceController');
    const controller = createExperienceController({
      checkAvailability: async () => unavailable,
      createHome: () => home,
      createMotionPermission: () => motion,
      createShowroom: async () => createShowroomMock([]),
      loadARExperience,
    });

    controller.start();
    await flushPromises();
    home.enter();

    expect(home.setAvailability).toHaveBeenCalledWith(unavailable);
    expect(loadARExperience).not.toHaveBeenCalled();
    expect(controller.mode).toBe('showroom');

    controller.destroy();
  });

  it('keeps appearance state in the controller across changes and reset', async () => {
    const actions: string[] = [];
    const home = createHomeMock();
    const showroom = createShowroomMock(actions);
    const {createExperienceController} = await import('./experienceController');
    const controller = createExperienceController({
      checkAvailability: async () => ({status: 'available'}),
      createHome: () => home,
      createMotionPermission: () => createMotionMock(),
      createShowroom: async () => showroom,
    });

    controller.start();
    await flushPromises();
    home.changeAppearance({color: 'gold', finish: 'matte'});

    expect(home.setAppearance).toHaveBeenLastCalledWith({
      color: 'gold',
      finish: 'matte',
    });
    expect(showroom.setAppearance).toHaveBeenLastCalledWith({
      color: 'gold',
      finish: 'matte',
    });

    home.restoreAppearance();
    expect(home.setAppearance).toHaveBeenLastCalledWith({
      color: 'silver',
      finish: 'polished',
    });
    expect(showroom.setAppearance).toHaveBeenLastCalledWith({
      color: 'silver',
      finish: 'polished',
    });

    controller.destroy();
  });

  it('allows an AR attempt when only the showroom model failed', async () => {
    const actions: string[] = [];
    const home = createHomeMock();
    const motion = createMotionMock();
    const ar = createARMock(actions);
    const {createExperienceController} = await import('./experienceController');
    const controller = createExperienceController({
      checkAvailability: async () => ({status: 'available'}),
      createHome: () => home,
      createMotionPermission: () => motion,
      createShowroom: async () => {
        throw new Error('preview failed');
      },
      loadARExperience: async () => ({createARExperience: async () => ar}),
      needsMotionPermission: () => false,
      waitForHandoff: async () => undefined,
    });

    controller.start();
    await flushPromises();
    home.enter();
    await flushPromises();

    expect(home.setPhase).toHaveBeenCalledWith('error');
    expect(actions).toContain('ar:start');
    expect(controller.mode).toBe('ar');

    controller.destroy();
  });
});

function createHomeMock(): TestUI {
  let appearanceHandler:
    | ((appearance: ModelAppearanceConfig) => void)
    | undefined;
  let customizationHandler: ((open: boolean) => void) | undefined;
  let enterHandler: (() => void) | undefined;
  let resetHandler: (() => void) | undefined;
  let restoreHandler: (() => void) | undefined;
  let retryHandler: (() => void) | undefined;
  const canvas = {} as HTMLCanvasElement;

  return {
    canvas,
    destroy: vi.fn(),
    dismissInteractionHint: vi.fn(),
    hide: vi.fn(),
    onAppearanceChange(handler): void {
      appearanceHandler = handler;
    },
    onCustomizationOpenChange(handler): void {
      customizationHandler = handler;
    },
    onEnterAR(handler): void {
      enterHandler = handler;
    },
    onResetView(handler): void {
      resetHandler = handler;
    },
    onRestoreAppearance(handler): void {
      restoreHandler = handler;
    },
    onRetryPreview(handler): void {
      retryHandler = handler;
    },
    setAvailability: vi.fn(),
    setAppearance: vi.fn(),
    setBusy: vi.fn(),
    setEntryError: vi.fn(),
    setPhase: vi.fn(),
    show: vi.fn(),
    changeAppearance(nextAppearance): void {
      appearanceHandler?.(nextAppearance);
    },
    customize(open): void {
      customizationHandler?.(open);
    },
    enter(): void {
      enterHandler?.();
    },
    reset(): void {
      resetHandler?.();
    },
    restoreAppearance(): void {
      restoreHandler?.();
    },
    retry(): void {
      retryHandler?.();
    },
  };
}

function createMotionMock(): TestMotionUI {
  let cancelHandler: (() => void) | undefined;
  let confirmHandler: (() => Promise<void>) | undefined;

  return {
    destroy: vi.fn(),
    hide: vi.fn(),
    onCancel(handler): void {
      cancelHandler = handler;
    },
    onConfirm(handler): void {
      confirmHandler = handler;
    },
    show: vi.fn(),
    cancel(): void {
      cancelHandler?.();
    },
    async confirm(): Promise<void> {
      await confirmHandler?.();
    },
  };
}

function createShowroomMock(actions: string[]): ShowroomSession {
  return {
    ready: Promise.resolve(),
    dispose: vi.fn(() => actions.push('showroom:dispose')),
    pause: vi.fn(() => actions.push('showroom:pause')),
    resetView: vi.fn(() => actions.push('showroom:reset')),
    resume: vi.fn(() => actions.push('showroom:resume')),
    setAppearance: vi.fn(() => actions.push('showroom:appearance')),
  };
}

function createARMock(actions: string[]): ARExperience {
  return {
    destroy: vi.fn(() => actions.push('ar:destroy')),
    pause: vi.fn(() => actions.push('ar:pause')),
    resume: vi.fn(() => actions.push('ar:resume')),
    start: vi.fn(() => actions.push('ar:start')),
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
