import {
  checkARAvailability,
  type ARAvailability,
} from '../ar/engine/availability';
import {
  needsExplicitMotionPermission,
  requestMotionPermission,
} from '../ar/engine/motionPermission';
import type {ARExperience} from '../ar/arExperience';
import {createShowroomSession} from '../showroom/showroom';
import type {ShowroomSession} from '../showroom/showroomTypes';
import {createHomeUI, type HomeUI} from '../ui/home';
import {
  createMotionPermissionUI,
  type MotionPermissionUI,
} from '../ui/motionPermission';

const HANDOFF_DURATION_MS = 180;

export type ExperienceMode = 'showroom' | 'handoff' | 'ar';

export interface ExperienceController {
  readonly mode: ExperienceMode;
  destroy(): void;
  pause(reason?: 'hidden' | 'pagehide'): void;
  resume(): void;
  start(): void;
}

interface ExperienceControllerDependencies {
  checkAvailability?: () => Promise<ARAvailability>;
  createHome?: () => HomeUI;
  createMotionPermission?: () => MotionPermissionUI;
  createShowroom?: (
    canvas: HTMLCanvasElement,
    options: {onInteraction: () => void},
  ) => Promise<ShowroomSession>;
  loadARExperience?: () => Promise<{
    createARExperience(): Promise<ARExperience>;
  }>;
  needsMotionPermission?: () => boolean;
  requestMotion?: () => Promise<void>;
  waitForHandoff?: () => Promise<void>;
}

export function createExperienceController(
  dependencies: ExperienceControllerDependencies = {},
): ExperienceController {
  const app = getElement<HTMLElement>('app');
  const cameraCanvas = getElement<HTMLCanvasElement>('camera-feed');
  const arStatusPanel = getElement<HTMLElement>('status-panel');
  const homeUI = (dependencies.createHome ?? createHomeUI)();
  const motionPermissionUI = (
    dependencies.createMotionPermission ?? createMotionPermissionUI
  )();
  const createShowroom = dependencies.createShowroom ?? createShowroomSession;
  const checkAvailability = dependencies.checkAvailability ?? checkARAvailability;
  const loadARExperience =
    dependencies.loadARExperience ?? (() => import('../ar/arExperience'));
  const needsMotionPermission =
    dependencies.needsMotionPermission ?? needsExplicitMotionPermission;
  const requestMotion = dependencies.requestMotion ?? requestMotionPermission;
  const waitForHandoff =
    dependencies.waitForHandoff ??
    (() => new Promise<void>((resolve) => setTimeout(resolve, HANDOFF_DURATION_MS)));
  let currentMode: ExperienceMode = 'showroom';
  let availability: ARAvailability = {status: 'checking'};
  let showroomSession: ShowroomSession | undefined;
  let arExperience: ARExperience | undefined;
  let availabilityPromise: Promise<ARAvailability> | undefined;
  let showroomLoadToken = 0;
  let handoffToken = 0;
  let permissionDialogOpen = false;
  let handoffStarted = false;
  let started = false;
  let destroyed = false;

  const setMode = (mode: ExperienceMode): void => {
    currentMode = mode;
    app.dataset.experienceMode = mode;
  };

  const loadShowroom = async (): Promise<void> => {
    const token = ++showroomLoadToken;
    showroomSession?.dispose();
    showroomSession = undefined;
    homeUI.setPhase('loading');
    homeUI.setEntryError();

    try {
      const session = await createShowroom(homeUI.canvas, {
        onInteraction: () => homeUI.dismissInteractionHint(),
      });

      if (destroyed || currentMode !== 'showroom' || token !== showroomLoadToken) {
        session.dispose();
        return;
      }

      showroomSession = session;
      homeUI.setPhase('entering');
      await session.ready;

      if (
        destroyed ||
        currentMode !== 'showroom' ||
        token !== showroomLoadToken ||
        showroomSession !== session
      ) {
        return;
      }

      homeUI.setPhase('ready');
    } catch (error: unknown) {
      if (destroyed || currentMode !== 'showroom' || token !== showroomLoadToken) {
        return;
      }

      console.error('[Showroom] Failed to start the 3D preview.', error);
      homeUI.setPhase('error');
    }
  };

  const resolveAvailability = (): Promise<ARAvailability> => {
    availabilityPromise ??= checkAvailability().then((result) => {
      availability = result;
      if (!destroyed && currentMode === 'showroom') {
        homeUI.setAvailability(result);
      }
      return result;
    });

    return availabilityPromise;
  };

  const commitHandoff = async (): Promise<void> => {
    if (destroyed || handoffStarted || currentMode !== 'showroom') {
      return;
    }

    handoffStarted = true;
    homeUI.setBusy(true);
    homeUI.setEntryError();
    showroomSession?.pause();
    const token = ++handoffToken;
    let preparedExperience: ARExperience | undefined;

    try {
      const arModule = await loadARExperience();
      preparedExperience = await arModule.createARExperience();

      if (destroyed || token !== handoffToken) {
        preparedExperience.destroy();
        return;
      }

      setMode('handoff');
      await waitForHandoff();

      if (destroyed || token !== handoffToken) {
        preparedExperience.destroy();
        return;
      }

      showroomSession?.dispose();
      showroomSession = undefined;
      homeUI.hide();
      cameraCanvas.hidden = false;
      cameraCanvas.removeAttribute('aria-hidden');
      arStatusPanel.hidden = false;
      arStatusPanel.removeAttribute('aria-hidden');
      arExperience = preparedExperience;
      preparedExperience = undefined;
      setMode('ar');
      arExperience.start();
    } catch (error: unknown) {
      preparedExperience?.destroy();
      console.error('[WebAR] Failed to prepare the AR runtime.', error);
      handoffStarted = false;
      setMode('showroom');
      homeUI.setBusy(false);
      homeUI.setEntryError(
        'Não foi possível preparar a experiência em RA. Tente novamente.',
      );
      if (!permissionDialogOpen && document.visibilityState === 'visible') {
        showroomSession?.resume();
      }
    }
  };

  const handleEnterAR = (): void => {
    if (destroyed || handoffStarted || availability.status !== 'available') {
      return;
    }

    if (needsMotionPermission()) {
      permissionDialogOpen = true;
      showroomSession?.pause();
      motionPermissionUI.show();
      return;
    }

    void commitHandoff();
  };

  homeUI.onEnterAR(handleEnterAR);
  homeUI.onRetryPreview(() => {
    if (!destroyed && currentMode === 'showroom') {
      void loadShowroom();
    }
  });
  homeUI.onResetView(() => showroomSession?.resetView());
  motionPermissionUI.onCancel(() => {
    permissionDialogOpen = false;
    if (!destroyed && currentMode === 'showroom' && document.visibilityState === 'visible') {
      showroomSession?.resume();
    }
  });
  motionPermissionUI.onConfirm(async () => {
    try {
      await requestMotion();
      permissionDialogOpen = false;
      motionPermissionUI.hide(false);
      await commitHandoff();
    } catch (error: unknown) {
      permissionDialogOpen = false;
      motionPermissionUI.hide(false);
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível acessar os sensores de movimento.';
      homeUI.setEntryError(message);
      if (!destroyed && document.visibilityState === 'visible') {
        showroomSession?.resume();
      }
    }
  });

  return {
    get mode(): ExperienceMode {
      return currentMode;
    },

    start(): void {
      if (started || destroyed) {
        return;
      }

      started = true;
      setMode('showroom');
      cameraCanvas.hidden = true;
      cameraCanvas.setAttribute('aria-hidden', 'true');
      arStatusPanel.hidden = true;
      arStatusPanel.setAttribute('aria-hidden', 'true');
      homeUI.show();
      homeUI.setAvailability(availability);
      void loadShowroom();
      void resolveAvailability();
    },

    pause(reason = 'hidden'): void {
      if (destroyed) {
        return;
      }

      if (currentMode === 'ar') {
        arExperience?.pause(reason);
      } else {
        showroomSession?.pause();
      }
    },

    resume(): void {
      if (destroyed) {
        return;
      }

      if (currentMode === 'ar') {
        arExperience?.resume();
      } else if (currentMode === 'showroom' && !permissionDialogOpen) {
        showroomSession?.resume();
      }
    },

    destroy(): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      showroomLoadToken += 1;
      handoffToken += 1;
      motionPermissionUI.destroy();
      homeUI.destroy();
      showroomSession?.dispose();
      showroomSession = undefined;
      arExperience?.destroy();
      arExperience = undefined;
    },
  };
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Required UI element #${id} was not found.`);
  }

  return element as T;
}
