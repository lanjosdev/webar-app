import type {ARPhase, ARSnapshot, TrackingState} from '../ar/tracking/trackingState';

const PHASE_MESSAGES: Record<ARPhase, string> = {
  idle: 'Pronto para iniciar a experiência.',
  'loading-engine': 'Carregando o 8th Wall Engine…',
  'loading-slam': 'Preparando o World Tracking…',
  'requesting-camera': 'Permita o acesso à câmera para continuar.',
  'tracking-initializing': 'Inicializando o tracking. Movimente lentamente o celular.',
  'tracking-ready': 'Tracking ativo. O cubo deve permanecer estável enquanto você se move.',
  'tracking-limited': 'Tracking limitado. Aponte para uma área iluminada e com mais detalhes.',
  error: 'Não foi possível iniciar a experiência.',
};

export interface StatusUI {
  destroy(): void;
  onStart(handler: () => void): void;
}

export function createStatusUI(trackingState: TrackingState): StatusUI {
  const panel = getElement<HTMLElement>('status-panel');
  const message = getElement<HTMLParagraphElement>('status-message');
  const errorDetails = getElement<HTMLParagraphElement>('error-details');
  const startButton = getElement<HTMLButtonElement>('start-ar');
  let startHandler: (() => void) | undefined;

  const handleClick = (): void => startHandler?.();
  startButton.addEventListener('click', handleClick);

  const unsubscribe = trackingState.subscribe((snapshot) => {
    render(snapshot, {errorDetails, message, panel, startButton});
  });

  return {
    onStart(handler): void {
      startHandler = handler;
    },
    destroy(): void {
      unsubscribe();
      startButton.removeEventListener('click', handleClick);
      startHandler = undefined;
    },
  };
}

function render(
  snapshot: ARSnapshot,
  elements: {
    errorDetails: HTMLParagraphElement;
    message: HTMLParagraphElement;
    panel: HTMLElement;
    startButton: HTMLButtonElement;
  },
): void {
  const {errorDetails, message, panel, startButton} = elements;
  panel.dataset.phase = snapshot.phase;
  message.textContent = snapshot.error?.message ?? PHASE_MESSAGES[snapshot.phase];

  const canStart = snapshot.phase === 'idle' || snapshot.phase === 'error';
  startButton.hidden = !canStart;
  startButton.disabled = !canStart;
  startButton.textContent = snapshot.phase === 'error' ? 'Tentar novamente' : 'Iniciar AR';

  if (snapshot.error) {
    errorDetails.hidden = false;
    errorDetails.textContent = `Código: ${snapshot.error.code}`;
  } else {
    errorDetails.hidden = true;
    errorDetails.textContent = '';
  }
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Required UI element #${id} was not found.`);
  }

  return element as T;
}
