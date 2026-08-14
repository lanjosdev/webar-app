export interface MotionPermissionUI {
  destroy(): void;
  hide(restoreFocus?: boolean): void;
  onCancel(handler: () => void): void;
  onConfirm(handler: () => Promise<void>): void;
  show(): void;
}

export function createMotionPermissionUI(): MotionPermissionUI {
  const sheet = getElement<HTMLElement>('motion-permission-sheet');
  const blocker = getElement<HTMLElement>('motion-permission-blocker');
  const cancelButton = getElement<HTMLButtonElement>('cancel-motion-permission');
  const confirmButton = getElement<HTMLButtonElement>('confirm-motion-permission');
  let confirmHandler: (() => Promise<void>) | undefined;
  let cancelHandler: (() => void) | undefined;
  let previousFocus: HTMLElement | null = null;
  let isOpen = false;
  let isSubmitting = false;

  const setBusy = (busy: boolean): void => {
    isSubmitting = busy;
    sheet.setAttribute('aria-busy', String(busy));
    cancelButton.disabled = busy;
    confirmButton.disabled = busy;
    confirmButton.textContent = busy ? 'Solicitando…' : 'Continuar';
  };

  const hide = (restoreFocus = true): void => {
    if (!isOpen) {
      return;
    }

    isOpen = false;
    sheet.hidden = true;
    blocker.hidden = true;
    setBusy(false);

    if (restoreFocus && previousFocus?.isConnected) {
      previousFocus.focus();
    }

    previousFocus = null;
  };

  const show = (): void => {
    if (isOpen) {
      return;
    }

    isOpen = true;
    previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    blocker.hidden = false;
    sheet.hidden = false;
    cancelButton.focus();
  };

  const handleCancel = (): void => {
    if (!isSubmitting) {
      hide();
      cancelHandler?.();
    }
  };

  const handleConfirm = (): void => {
    if (isSubmitting || !confirmHandler) {
      return;
    }

    setBusy(true);

    // Calling the handler directly from this event is essential: Safari only
    // accepts requestPermission() while this user activation is still active.
    void confirmHandler().finally(() => {
      if (isOpen) {
        setBusy(false);
      }
    });
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (!isOpen || isSubmitting) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      hide();
      cancelHandler?.();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    if (event.shiftKey && document.activeElement === cancelButton) {
      event.preventDefault();
      confirmButton.focus();
    } else if (!event.shiftKey && document.activeElement === confirmButton) {
      event.preventDefault();
      cancelButton.focus();
    }
  };

  cancelButton.addEventListener('click', handleCancel);
  confirmButton.addEventListener('click', handleConfirm);
  document.addEventListener('keydown', handleKeydown);

  return {
    show,
    hide,
    onCancel(handler): void {
      cancelHandler = handler;
    },
    onConfirm(handler): void {
      confirmHandler = handler;
    },
    destroy(): void {
      hide(false);
      cancelButton.removeEventListener('click', handleCancel);
      confirmButton.removeEventListener('click', handleConfirm);
      document.removeEventListener('keydown', handleKeydown);
      cancelHandler = undefined;
      confirmHandler = undefined;
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
