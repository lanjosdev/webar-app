import type {ARAvailability} from '../ar/engine/availability';
import type {ShowroomPhase} from '../showroom/showroomTypes';
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
  onEnterAR(handler: () => void): void;
  onResetView(handler: () => void): void;
  onRetryPreview(handler: () => void): void;
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
  const enterButton = getElement<HTMLButtonElement>('enter-ar');
  const availabilityMessage = getElement<HTMLParagraphElement>(
    'ar-availability-message',
  );
  const entryError = getElement<HTMLParagraphElement>('showroom-entry-error');
  const desktopHandoff = createDesktopHandoff();
  let enterHandler: (() => void) | undefined;
  let retryHandler: (() => void) | undefined;
  let resetHandler: (() => void) | undefined;
  let availability: ARAvailability = {status: 'checking'};
  let busy = false;
  let interactionHintDismissed = false;

  const renderEntryAction = (): void => {
    if (availability.status === 'unavailable') {
      enterButton.hidden = true;
      const showDesktopHandoff = availability.reason === 'mobile-required';
      availabilityMessage.hidden = showDesktopHandoff;
      availabilityMessage.textContent = showDesktopHandoff
        ? ''
        : AVAILABILITY_MESSAGES[availability.reason];
      if (showDesktopHandoff) {
        desktopHandoff.show(createMobileExperienceUrl(window.location));
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

  const setPhase = (phase: ShowroomPhase): void => {
    screen.dataset.previewPhase = phase;
    const ready = phase === 'ready';
    loading.hidden = phase !== 'loading';
    error.hidden = phase !== 'error';
    canvas.hidden = phase === 'error';
    resetButton.hidden = !ready;
    hint.hidden = !ready || interactionHintDismissed;
    canvas.setAttribute('aria-busy', String(phase === 'loading'));

    if (phase === 'error') {
      errorMessage.textContent =
        'Não foi possível carregar a prévia 3D. Você pode tentar novamente.';
    }
  };

  const handleEnterClick = (): void => enterHandler?.();
  const handleRetryClick = (): void => retryHandler?.();
  const handleResetClick = (): void => resetHandler?.();

  enterButton.addEventListener('click', handleEnterClick);
  retryButton.addEventListener('click', handleRetryClick);
  resetButton.addEventListener('click', handleResetClick);
  setPhase('loading');
  renderEntryAction();

  return {
    canvas,
    dismissInteractionHint(): void {
      interactionHintDismissed = true;
      hint.hidden = true;
    },
    hide(): void {
      screen.hidden = true;
      screen.setAttribute('aria-hidden', 'true');
    },
    onEnterAR(handler): void {
      enterHandler = handler;
    },
    onResetView(handler): void {
      resetHandler = handler;
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
      enterButton.removeEventListener('click', handleEnterClick);
      retryButton.removeEventListener('click', handleRetryClick);
      resetButton.removeEventListener('click', handleResetClick);
      enterHandler = undefined;
      retryHandler = undefined;
      resetHandler = undefined;
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
