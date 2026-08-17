import type {ARAvailability} from '../ar/engine/availability';
import type {ShowroomPhase} from '../showroom/showroomTypes';
import {
  DEFAULT_MODEL_APPEARANCE,
  normalizeModelAppearance,
  type ModelAppearanceConfig,
  type ModelColorId,
  type ModelFinishId,
} from '../three/modelAppearance';
import {
  createDesktopHandoff,
  createMobileExperienceUrl,
} from './desktopHandoff';

const AVAILABILITY_MESSAGES: Record<
  Exclude<ARAvailability, {status: 'checking'} | {status: 'available'}>['reason'],
  string
> = {
  'engine-error':
    'A prévia 3D continua disponível, mas a experiência em RA não pôde ser preparada agora.',
  'insecure-context':
    'Abra esta página por uma conexão HTTPS segura em um celular compatível para usar a RA.',
  'mobile-required':
    'A experiência em RA está disponível em celulares compatíveis. Abra esta página no seu celular.',
  'unsupported-browser':
    'Este navegador não oferece os recursos necessários para a RA. Use Safari no iPhone ou um navegador compatível no Android.',
};

export interface HomeUI {
  readonly canvas: HTMLCanvasElement;
  destroy(): void;
  dismissInteractionHint(): void;
  hide(): void;
  onAppearanceChange(handler: (appearance: ModelAppearanceConfig) => void): void;
  onCustomizationOpenChange(handler: (open: boolean) => void): void;
  onEnterAR(handler: () => void): void;
  onResetView(handler: () => void): void;
  onRestoreAppearance(handler: () => void): void;
  onRetryPreview(handler: () => void): void;
  setAppearance(appearance: ModelAppearanceConfig): void;
  setAvailability(availability: ARAvailability): void;
  setBusy(busy: boolean): void;
  setEntryError(message?: string): void;
  setPhase(phase: ShowroomPhase): void;
  show(): void;
}

export function createHomeUI(): HomeUI {
  const screen = getElement<HTMLElement>('showroom-screen');
  const canvas = getElement<HTMLCanvasElement>('showroom-canvas');
  const loading = getElement<HTMLElement>('showroom-loading');
  const error = getElement<HTMLElement>('showroom-error');
  const errorMessage = getElement<HTMLParagraphElement>('showroom-error-message');
  const retryButton = getElement<HTMLButtonElement>('showroom-retry');
  const resetButton = getElement<HTMLButtonElement>('showroom-reset');
  const hint = getElement<HTMLElement>('showroom-hint');
  const customizeButton = getElement<HTMLButtonElement>('showroom-customize');
  const customizationPanel = getElement<HTMLElement>('showroom-customization');
  const customizationClose = getElement<HTMLButtonElement>(
    'showroom-customization-close',
  );
  const customizationRestore = getElement<HTMLButtonElement>(
    'showroom-customization-restore',
  );
  const enterButton = getElement<HTMLButtonElement>('enter-ar');
  const availabilityMessage = getElement<HTMLParagraphElement>(
    'ar-availability-message',
  );
  const entryError = getElement<HTMLParagraphElement>('showroom-entry-error');
  const desktopHandoff = createDesktopHandoff();
  const colorInputs: Record<ModelColorId, HTMLInputElement> = {
    gold: getElement<HTMLInputElement>('appearance-color-gold'),
    graphite: getElement<HTMLInputElement>('appearance-color-graphite'),
    silver: getElement<HTMLInputElement>('appearance-color-silver'),
  };
  const finishInputs: Record<ModelFinishId, HTMLInputElement> = {
    matte: getElement<HTMLInputElement>('appearance-finish-matte'),
    polished: getElement<HTMLInputElement>('appearance-finish-polished'),
    satin: getElement<HTMLInputElement>('appearance-finish-satin'),
  };
  let appearanceChangeHandler:
    | ((appearance: ModelAppearanceConfig) => void)
    | undefined;
  let customizationOpenHandler: ((open: boolean) => void) | undefined;
  let enterHandler: (() => void) | undefined;
  let retryHandler: (() => void) | undefined;
  let resetHandler: (() => void) | undefined;
  let restoreAppearanceHandler: (() => void) | undefined;
  let availability: ARAvailability = {status: 'checking'};
  let appearance = {...DEFAULT_MODEL_APPEARANCE};
  let phase: ShowroomPhase = 'loading';
  let busy = false;
  let customizationOpen = false;
  let interactionHintDismissed = false;

  const renderHint = (): void => {
    hint.hidden =
      phase !== 'ready' || interactionHintDismissed || customizationOpen;
  };

  const closeCustomization = (restoreFocus: boolean): void => {
    if (!customizationOpen) {
      return;
    }

    customizationOpen = false;
    customizationPanel.hidden = true;
    customizeButton.setAttribute('aria-expanded', 'false');
    renderHint();
    customizationOpenHandler?.(false);

    if (restoreFocus && !customizeButton.hidden && !customizeButton.disabled) {
      customizeButton.focus();
    }
  };

  const renderCustomizationAvailability = (): void => {
    const ready = phase === 'ready';
    customizeButton.hidden = !ready;
    customizeButton.disabled = !ready || busy;

    if (!ready || busy) {
      closeCustomization(false);
    }
  };

  const renderAppearanceSelection = (): void => {
    colorInputs[appearance.color].checked = true;
    finishInputs[appearance.finish].checked = true;
  };

  const renderEntryAction = (): void => {
    if (availability.status === 'unavailable') {
      enterButton.hidden = true;
      const showDesktopHandoff = availability.reason === 'mobile-required';
      availabilityMessage.hidden = showDesktopHandoff;
      availabilityMessage.textContent = showDesktopHandoff
        ? ''
        : AVAILABILITY_MESSAGES[availability.reason];
      if (showDesktopHandoff) {
        desktopHandoff.show(
          createMobileExperienceUrl(window.location, appearance),
        );
      } else {
        desktopHandoff.hide();
      }
      return;
    }

    desktopHandoff.hide();
    enterButton.hidden = false;
    availabilityMessage.hidden = availability.status === 'available';
    availabilityMessage.textContent =
      availability.status === 'checking'
        ? 'Verificando compatibilidade com realidade aumentada…'
        : '';
    enterButton.disabled = busy || availability.status === 'checking';
    enterButton.textContent = busy
      ? 'Preparando experiência…'
      : 'Ver na experiência webAR';
  };

  const setPhase = (nextPhase: ShowroomPhase): void => {
    phase = nextPhase;
    screen.dataset.previewPhase = nextPhase;
    const ready = nextPhase === 'ready';
    loading.hidden = nextPhase !== 'loading';
    error.hidden = nextPhase !== 'error';
    canvas.hidden = nextPhase === 'error';
    resetButton.hidden = !ready;
    canvas.setAttribute(
      'aria-busy',
      String(nextPhase === 'loading' || nextPhase === 'entering'),
    );
    canvas.setAttribute('aria-disabled', String(!ready));
    renderCustomizationAvailability();
    renderHint();

    if (nextPhase === 'error') {
      errorMessage.textContent =
        'Não foi possível carregar a prévia 3D. Você pode tentar novamente.';
    }
  };

  const handleEnterClick = (): void => enterHandler?.();
  const handleRetryClick = (): void => retryHandler?.();
  const handleResetClick = (): void => resetHandler?.();
  const handleCustomizeClick = (): void => {
    if (customizeButton.disabled || customizeButton.hidden) {
      return;
    }

    customizationOpen = true;
    customizationPanel.hidden = false;
    customizeButton.setAttribute('aria-expanded', 'true');
    interactionHintDismissed = true;
    renderHint();
    customizationOpenHandler?.(true);
    customizationClose.focus();
  };
  const handleCustomizationClose = (): void => closeCustomization(true);
  const handleCustomizationRestore = (): void => restoreAppearanceHandler?.();
  const handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && customizationOpen) {
      event.preventDefault();
      closeCustomization(true);
    }
  };
  const inputCleanups: Array<() => void> = [];

  Object.entries(colorInputs).forEach(([color, input]) => {
    const handleChange = (): void => {
      if (input.checked) {
        appearanceChangeHandler?.(
          normalizeModelAppearance({...appearance, color: color as ModelColorId}),
        );
      }
    };
    input.addEventListener('change', handleChange);
    inputCleanups.push(() => input.removeEventListener('change', handleChange));
  });

  Object.entries(finishInputs).forEach(([finish, input]) => {
    const handleChange = (): void => {
      if (input.checked) {
        appearanceChangeHandler?.(
          normalizeModelAppearance({
            ...appearance,
            finish: finish as ModelFinishId,
          }),
        );
      }
    };
    input.addEventListener('change', handleChange);
    inputCleanups.push(() => input.removeEventListener('change', handleChange));
  });

  enterButton.addEventListener('click', handleEnterClick);
  retryButton.addEventListener('click', handleRetryClick);
  resetButton.addEventListener('click', handleResetClick);
  customizeButton.addEventListener('click', handleCustomizeClick);
  customizationClose.addEventListener('click', handleCustomizationClose);
  customizationRestore.addEventListener('click', handleCustomizationRestore);
  document.addEventListener('keydown', handleDocumentKeyDown);
  renderAppearanceSelection();
  setPhase('loading');
  renderEntryAction();

  return {
    canvas,
    dismissInteractionHint(): void {
      interactionHintDismissed = true;
      renderHint();
    },
    hide(): void {
      screen.hidden = true;
      screen.setAttribute('aria-hidden', 'true');
    },
    onEnterAR(handler): void {
      enterHandler = handler;
    },
    onAppearanceChange(handler): void {
      appearanceChangeHandler = handler;
    },
    onCustomizationOpenChange(handler): void {
      customizationOpenHandler = handler;
    },
    onResetView(handler): void {
      resetHandler = handler;
    },
    onRestoreAppearance(handler): void {
      restoreAppearanceHandler = handler;
    },
    onRetryPreview(handler): void {
      retryHandler = handler;
    },
    setAvailability(nextAvailability): void {
      availability = nextAvailability;
      renderEntryAction();
    },
    setBusy(nextBusy): void {
      busy = nextBusy;
      screen.dataset.busy = String(busy);
      renderCustomizationAvailability();
      renderEntryAction();
    },
    setAppearance(nextAppearance): void {
      appearance = normalizeModelAppearance(nextAppearance);
      renderAppearanceSelection();
      renderEntryAction();
    },
    setEntryError(message): void {
      entryError.hidden = !message;
      entryError.textContent = message ?? '';
    },
    setPhase,
    show(): void {
      screen.hidden = false;
      screen.removeAttribute('aria-hidden');
    },
    destroy(): void {
      desktopHandoff.destroy();
      closeCustomization(false);
      enterButton.removeEventListener('click', handleEnterClick);
      retryButton.removeEventListener('click', handleRetryClick);
      resetButton.removeEventListener('click', handleResetClick);
      customizeButton.removeEventListener('click', handleCustomizeClick);
      customizationClose.removeEventListener('click', handleCustomizationClose);
      customizationRestore.removeEventListener(
        'click',
        handleCustomizationRestore,
      );
      document.removeEventListener('keydown', handleDocumentKeyDown);
      inputCleanups.forEach((cleanup) => cleanup());
      appearanceChangeHandler = undefined;
      customizationOpenHandler = undefined;
      enterHandler = undefined;
      retryHandler = undefined;
      resetHandler = undefined;
      restoreAppearanceHandler = undefined;
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
