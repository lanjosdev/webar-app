import type {ARPhase, ARSnapshot, TrackingState} from '../ar/tracking/trackingState';

const PHASE_MESSAGES: Record<ARPhase, string> = {
  idle: 'Pronto para iniciar a experiência.',
  'loading-engine': 'Carregando o 8th Wall Engine…',
  'loading-slam': 'Preparando o World Tracking…',
  'loading-model': 'Carregando o modelo 3D…',
  'requesting-motion': 'Autorize o acesso aos sensores de movimento para continuar.',
  'requesting-camera': 'Permita o acesso à câmera para continuar.',
  'tracking-initializing':
    'Inicializando o tracking. Aponte para um piso texturizado e movimente lentamente.',
  'tracking-ready': 'Mire no chão e toque para posicionar.',
  'tracking-limited':
    'Tracking instável. Mova o celular lentamente e aponte para um piso iluminado e com textura.',
  'tracking-recovering':
    'Recuperando o tracking. Aponte para o piso e mova o celular lentamente.',
  paused: 'Experiência pausada. Volte para esta página para retomar.',
  error: 'Não foi possível iniciar a experiência.',
};

export interface StatusUI {
  destroy(): void;
  onRecenter(handler: () => boolean): void;
  onStart(handler: () => void): void;
}

export function createStatusUI(trackingState: TrackingState): StatusUI {
  const app = getElement<HTMLElement>('app');
  const panel = getElement<HTMLElement>('status-panel');
  const message = getElement<HTMLParagraphElement>('status-message');
  const errorDetails = getElement<HTMLParagraphElement>('error-details');
  const startButton = getElement<HTMLButtonElement>('start-ar');
  const recenterButton = getElement<HTMLButtonElement>('recenter-ar');
  const confirmation = getElement<HTMLElement>('recenter-confirmation');
  const cancelRecenterButton = getElement<HTMLButtonElement>('cancel-recenter');
  const confirmRecenterButton = getElement<HTMLButtonElement>('confirm-recenter');
  const interactionBlocker = getElement<HTMLElement>('interaction-blocker');
  let startHandler: (() => void) | undefined;
  let recenterHandler: (() => boolean) | undefined;
  let currentSnapshot = trackingState.current;
  let isConfirming = false;
  let isSubmittingRecenter = false;
  let previousFocus: HTMLElement | null = null;

  const handleStartClick = (): void => startHandler?.();

  const setConfirmationOpen = (open: boolean, restoreFocus = true): void => {
    if (isConfirming === open) {
      return;
    }

    isConfirming = open;
    app.dataset.recenterConfirming = String(open);
    confirmation.hidden = !open;
    interactionBlocker.hidden = !open;

    if (open) {
      previousFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      recenterButton.hidden = true;
      cancelRecenterButton.focus();
      return;
    }

    recenterButton.hidden = !isRecenterPhase(currentSnapshot.phase);
    recenterButton.disabled = recenterButton.hidden;
    if (restoreFocus && previousFocus?.isConnected && !recenterButton.hidden) {
      previousFocus.focus();
    }
    previousFocus = null;
  };

  const submitRecenter = (): void => {
    if (isSubmittingRecenter || !recenterHandler) {
      return;
    }

    isSubmittingRecenter = true;
    setConfirmationOpen(false, false);

    if (!recenterHandler()) {
      isSubmittingRecenter = false;
      render(currentSnapshot, {
        errorDetails,
        message,
        panel,
        confirmation,
        recenterButton,
        startButton,
      });
    }
  };

  const handleRecenterClick = (): void => {
    if (currentSnapshot.placement === 'placed') {
      setConfirmationOpen(true);
      return;
    }

    submitRecenter();
  };

  const handleCancelRecenterClick = (): void => setConfirmationOpen(false);

  const handleConfirmationKeydown = (event: KeyboardEvent): void => {
    if (!isConfirming) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setConfirmationOpen(false);
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    if (event.shiftKey && document.activeElement === cancelRecenterButton) {
      event.preventDefault();
      confirmRecenterButton.focus();
    } else if (!event.shiftKey && document.activeElement === confirmRecenterButton) {
      event.preventDefault();
      cancelRecenterButton.focus();
    }
  };

  startButton.addEventListener('click', handleStartClick);
  recenterButton.addEventListener('click', handleRecenterClick);
  cancelRecenterButton.addEventListener('click', handleCancelRecenterClick);
  confirmRecenterButton.addEventListener('click', submitRecenter);
  document.addEventListener('keydown', handleConfirmationKeydown);

  const unsubscribe = trackingState.subscribe((snapshot) => {
    currentSnapshot = snapshot;
    const canShowRecenter = isRecenterPhase(snapshot.phase);

    if (!canShowRecenter || snapshot.placement !== 'placed') {
      setConfirmationOpen(false, false);
    }

    if (snapshot.phase !== 'tracking-ready' && snapshot.phase !== 'tracking-limited') {
      isSubmittingRecenter = false;
    }

    render(snapshot, {
      errorDetails,
      message,
      panel,
      confirmation,
      recenterButton,
      startButton,
    });
  });

  return {
    onRecenter(handler): void {
      recenterHandler = handler;
    },
    onStart(handler): void {
      startHandler = handler;
    },
    destroy(): void {
      setConfirmationOpen(false, false);
      unsubscribe();
      startButton.removeEventListener('click', handleStartClick);
      recenterButton.removeEventListener('click', handleRecenterClick);
      cancelRecenterButton.removeEventListener('click', handleCancelRecenterClick);
      confirmRecenterButton.removeEventListener('click', submitRecenter);
      document.removeEventListener('keydown', handleConfirmationKeydown);
      startHandler = undefined;
      recenterHandler = undefined;
    },
  };
}

function render(
  snapshot: ARSnapshot,
  elements: {
    errorDetails: HTMLParagraphElement;
    message: HTMLParagraphElement;
    panel: HTMLElement;
    confirmation: HTMLElement;
    recenterButton: HTMLButtonElement;
    startButton: HTMLButtonElement;
  },
): void {
  const {
    confirmation,
    errorDetails,
    message,
    panel,
    recenterButton,
    startButton,
  } = elements;
  panel.dataset.phase = snapshot.phase;
  panel.dataset.placement = snapshot.placement;
  message.textContent = getStatusMessage(snapshot);

  const canStart = snapshot.phase === 'idle' || snapshot.phase === 'error';
  startButton.hidden = !canStart;
  startButton.disabled = !canStart;
  startButton.textContent = snapshot.phase === 'error' ? 'Tentar novamente' : 'Iniciar AR';

  const canRecenter = isRecenterPhase(snapshot.phase);
  recenterButton.hidden = !canRecenter || !confirmation.hidden;
  recenterButton.disabled = !canRecenter;

  if (snapshot.error) {
    errorDetails.hidden = false;
    errorDetails.textContent = `Código: ${snapshot.error.code}`;
  } else {
    errorDetails.hidden = true;
    errorDetails.textContent = '';
  }
}

function isRecenterPhase(phase: ARPhase): boolean {
  return phase === 'tracking-ready' || phase === 'tracking-limited';
}

export function getStatusMessage(snapshot: ARSnapshot): string {
  if (snapshot.error) {
    return snapshot.error.message;
  }

  if (snapshot.phase === 'tracking-ready' && snapshot.placement === 'placed') {
    return 'Objeto posicionado. Mire e toque novamente para reposicionar.';
  }

  return PHASE_MESSAGES[snapshot.phase];
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Required UI element #${id} was not found.`);
  }

  return element as T;
}
