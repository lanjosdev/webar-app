const QR_SIZE_PX = 140;
const COPY_STATUS_DURATION_MS = 3_000;

export interface DesktopHandoff {
  destroy(): void;
  hide(): void;
  show(url: string): void;
}

export function createMobileExperienceUrl(
  location: Pick<Location, 'origin' | 'pathname'>,
  appearance: ModelAppearanceConfig,
): string {
  const url = new URL(location.pathname, location.origin);
  url.search = createModelAppearanceSearchParams(appearance).toString();
  return url.href;
}

export function createDesktopHandoff(): DesktopHandoff {
  const container = getElement<HTMLElement>('desktop-handoff');
  const canvas = getElement<HTMLCanvasElement>('desktop-handoff-qr');
  const qrError = getElement<HTMLElement>('desktop-handoff-qr-error');
  const copyButton = getElement<HTMLButtonElement>('desktop-handoff-copy');
  const copyStatus = getElement<HTMLElement>('desktop-handoff-copy-status');
  let currentUrl = '';
  let renderId = 0;
  let statusTimeout: ReturnType<typeof setTimeout> | undefined;

  const clearCopyStatus = (): void => {
    if (statusTimeout !== undefined) {
      clearTimeout(statusTimeout);
      statusTimeout = undefined;
    }
    copyStatus.textContent = '';
  };

  const setCopyStatus = (message: string): void => {
    clearCopyStatus();
    copyStatus.textContent = message;
    statusTimeout = setTimeout(clearCopyStatus, COPY_STATUS_DURATION_MS);
  };

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopyStatus('Link copiado.');
    } catch (error: unknown) {
      console.warn('[Showroom] Could not copy the mobile handoff URL.', error);
      setCopyStatus('Não foi possível copiar o link.');
    }
  };

  const renderQRCode = async (url: string, requestId: number): Promise<void> => {
    try {
      const {toCanvas} = await import('qrcode');
      if (requestId !== renderId) return;

      await toCanvas(canvas, url, {
        color: {dark: '#090909', light: '#ffffff'},
        errorCorrectionLevel: 'M',
        margin: 2,
        width: QR_SIZE_PX,
      });

      if (requestId !== renderId) return;
      canvas.hidden = false;
      qrError.hidden = true;
    } catch (error: unknown) {
      if (requestId !== renderId) return;
      console.warn('[Showroom] Could not render the mobile handoff QR code.', error);
      canvas.hidden = true;
      qrError.hidden = false;
    }
  };

  const handleCopyClick = (): void => {
    void copyLink();
  };

  copyButton.addEventListener('click', handleCopyClick);

  return {
    destroy(): void {
      renderId += 1;
      clearCopyStatus();
      copyButton.removeEventListener('click', handleCopyClick);
    },
    hide(): void {
      renderId += 1;
      container.hidden = true;
      clearCopyStatus();
    },
    show(url): void {
      currentUrl = url;
      container.hidden = false;
      canvas.hidden = true;
      qrError.hidden = true;
      clearCopyStatus();
      renderId += 1;
      void renderQRCode(url, renderId);
    },
  };
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element as T;
}
import {
  createModelAppearanceSearchParams,
  type ModelAppearanceConfig,
} from '../three/modelAppearance';
