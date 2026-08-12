import type {EngineCaptureSession} from '../ar/capture/engineCapture';
import {
  createCaptureAsset,
  disposeCaptureAsset,
  downloadCaptureAsset,
  shareCaptureAsset,
} from '../ar/capture/captureMedia';
import {CaptureState} from '../ar/capture/captureState';
import {
  CAPTURE_VIDEO_MAX_DURATION_MS,
  CaptureError,
  type CaptureAsset,
  type CaptureMode,
  type CaptureSnapshot,
} from '../ar/capture/captureTypes';
import type {ARSnapshot, TrackingState} from '../ar/tracking/trackingState';
import type {DiagnosticsSink} from '../diagnostics/diagnosticsTypes';

type InterruptionReason = 'hidden' | 'orientation' | 'pagehide';

export interface CaptureUI {
  destroy(): void;
  handleInterruption(reason: InterruptionReason): boolean;
  shouldKeepARPaused(): boolean;
}

export interface CaptureUIOptions {
  diagnostics?: DiagnosticsSink;
  pauseAR(): void;
  prepareCapture(): Promise<EngineCaptureSession>;
  resumeAR(): void;
  setInteractionLocked(locked: boolean): void;
  trackingState: TrackingState;
}

interface CaptureTrackingActions {
  prepare(): void;
  render(): void;
  reset(): void;
}

export function synchronizeCaptureTracking(
  snapshot: ARSnapshot,
  actions: CaptureTrackingActions,
): void {
  if (snapshot.phase === 'error' || snapshot.phase === 'idle') {
    actions.reset();
    return;
  }

  // Tracking and capture are independent state machines. Always invalidate the
  // capture UI first; preparing the Engine modules may legitimately be a no-op
  // when an existing capture session is being reused after preview or recenter.
  actions.render();

  if (isTrackingCaptureReady(snapshot)) {
    actions.prepare();
  }
}

export function createCaptureUI(options: CaptureUIOptions): CaptureUI {
  const app = getElement<HTMLElement>('app');
  const controls = getElement<HTMLElement>('capture-controls');
  const photoModeButton = getElement<HTMLButtonElement>('capture-mode-photo');
  const videoModeButton = getElement<HTMLButtonElement>('capture-mode-video');
  const shutterButton = getElement<HTMLButtonElement>('capture-shutter');
  const timer = getElement<HTMLParagraphElement>('capture-timer');
  const feedback = getElement<HTMLParagraphElement>('capture-feedback');
  const retryButton = getElement<HTMLButtonElement>('capture-retry');
  const flash = getElement<HTMLElement>('capture-flash');
  const processing = getElement<HTMLElement>('capture-processing');
  const processingMessage = getElement<HTMLParagraphElement>('capture-processing-message');
  const processingProgress = getElement<HTMLProgressElement>('capture-processing-progress');
  const preview = getElement<HTMLElement>('capture-preview');
  const previewStatus = getElement<HTMLParagraphElement>('capture-preview-status');
  const previewImage = getElement<HTMLImageElement>('capture-preview-image');
  const previewVideo = getElement<HTMLVideoElement>('capture-preview-video');
  const retakeButton = getElement<HTMLButtonElement>('capture-retake');
  const saveButton = getElement<HTMLButtonElement>('capture-save');
  const shareButton = getElement<HTMLButtonElement>('capture-share');
  const captureState = new CaptureState();

  let arSnapshot = options.trackingState.current;
  let captureSession: EngineCaptureSession | undefined;
  let preparePromise: Promise<EngineCaptureSession> | undefined;
  let activeAsset: CaptureAsset | undefined;
  let renderedAssetUrl: string | undefined;
  let recordingStartedAt: number | undefined;
  let recordingDurationMs = 0;
  let recordingStopReason = 'manual';
  let stopRequested = false;
  let recordingTimer: ReturnType<typeof setInterval> | undefined;
  let recordingTimeout: ReturnType<typeof setTimeout> | undefined;
  let flashTimeout: ReturnType<typeof setTimeout> | undefined;
  let orientationResumeTimeout: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;
  let previewPausedAR = false;
  let previousFocus: HTMLElement | null = null;
  let transientPreviewMessage = '';
  let captureOperationId = 0;

  const setMode = (mode: CaptureMode): void => captureState.setMode(mode);
  const handlePhotoMode = (): void => setMode('photo');
  const handleVideoMode = (): void => setMode('video');
  const handleOrientationChange = (): void => {
    if (captureState.current.phase !== 'recording') {
      return;
    }

    stopVideo('orientation');
    options.pauseAR();
    if (orientationResumeTimeout !== undefined) {
      clearTimeout(orientationResumeTimeout);
    }
    orientationResumeTimeout = setTimeout(() => {
      orientationResumeTimeout = undefined;
      if (!destroyed && !previewPausedAR && document.visibilityState === 'visible') {
        options.resumeAR();
      }
    }, 300);
  };
  const handleShareClick = (): void => void handleShare();

  const handleShutter = (): void => {
    const {mode, phase} = captureState.current;

    if (phase === 'recording') {
      stopVideo('manual');
    } else if (phase === 'ready' && isTrackingCaptureReady(arSnapshot)) {
      if (mode === 'photo') {
        void takePhoto();
      } else {
        startVideo();
      }
    }
  };

  const handleRetry = (): void => {
    transientPreviewMessage = '';
    if (captureSession) {
      captureState.setReady();
      options.setInteractionLocked(false);
    } else {
      void prepareIfNeeded(arSnapshot);
    }
  };

  const takePhoto = async (): Promise<void> => {
    const session = captureSession;
    if (!session) {
      return;
    }

    const startedAt = performance.now();
    const operationId = ++captureOperationId;
    options.setInteractionLocked(true);
    captureState.setCapturingPhoto();
    options.diagnostics?.recordCapture('photo-start');

    try {
      const blob = await session.takePhoto();
      if (destroyed || operationId !== captureOperationId) {
        return;
      }

      const asset = createCaptureAsset({blob, kind: 'photo'});
      options.diagnostics?.recordCapture('photo-ready', {
        bytes: asset.bytes,
        latencyMs: performance.now() - startedAt,
      });
      showFlash();
      openPreview(asset);
    } catch (error: unknown) {
      if (destroyed || operationId !== captureOperationId) {
        return;
      }
      handleCaptureFailure(
        toCaptureError(error, 'PHOTO_CAPTURE_FAILED', 'Não foi possível tirar a foto.'),
      );
    }
  };

  const startVideo = (): void => {
    const session = captureSession;
    if (!session) {
      return;
    }

    options.setInteractionLocked(true);
    captureState.setRecording();
    stopRequested = false;
    recordingStopReason = 'auto';
    recordingDurationMs = 0;
    const operationId = ++captureOperationId;

    try {
      session.startVideo({
        onError: (error) => {
          if (operationId !== captureOperationId) {
            return;
          }
          handleCaptureFailure(
            toCaptureError(
              error,
              'VIDEO_RECORDING_FAILED',
              'Não foi possível gravar o vídeo.',
            ),
          );
        },
        onFinalizeProgress: ({progress, total}) => {
          if (operationId !== captureOperationId) {
            return;
          }
          const normalized = total > 0 ? progress / total : progress;
          captureState.setFinalizeProgress(normalized);
        },
        onPreviewReady: ({videoBlob}) => {
          if (destroyed || operationId !== captureOperationId) {
            return;
          }

          options.diagnostics?.recordCapture('video-preview', {bytes: videoBlob.size});
          const previewAsset = createCaptureAsset({
            blob: videoBlob,
            durationMs: recordingDurationMs,
            kind: 'video',
            mimeType: videoBlob.type || 'video/webm',
            shareReady: false,
          });
          openPreview(previewAsset, true);
        },
        onStart: () => {
          if (operationId !== captureOperationId) {
            return;
          }
          recordingStartedAt = performance.now();
          options.diagnostics?.recordCapture('video-start');
          startRecordingClock();
        },
        onStop: () => {
          if (operationId !== captureOperationId) {
            return;
          }
          recordingDurationMs = getRecordingElapsed();
          stopRecordingClock();
          captureState.setFinalizing();
          options.diagnostics?.recordCapture('video-stop', {
            durationMs: recordingDurationMs,
            reason: recordingStopReason,
          });
        },
        onVideoReady: ({videoBlob}) => {
          if (destroyed || operationId !== captureOperationId) {
            return;
          }

          const asset = createCaptureAsset({
            blob: videoBlob,
            durationMs: recordingDurationMs,
            kind: 'video',
            mimeType: 'video/mp4',
            shareReady: true,
          });
          options.diagnostics?.recordCapture('video-ready', {
            bytes: asset.bytes,
            durationMs: recordingDurationMs,
            finalizationMs: recordingStartedAt === undefined
              ? undefined
              : performance.now() - recordingStartedAt - recordingDurationMs,
          });
          openPreview(asset);
        },
      });
    } catch (error: unknown) {
      handleCaptureFailure(
        toCaptureError(error, 'VIDEO_RECORDING_FAILED', 'Não foi possível iniciar o vídeo.'),
      );
    }
  };

  const stopVideo = (reason: string): void => {
    if (captureState.current.phase !== 'recording' || stopRequested) {
      return;
    }

    stopRequested = true;
    recordingStopReason = reason;
    recordingDurationMs = getRecordingElapsed();
    captureState.setElapsed(recordingDurationMs);
    captureSession?.stopVideo();
  };

  const startRecordingClock = (): void => {
    stopRecordingClock();
    updateRecordingClock();
    recordingTimer = setInterval(updateRecordingClock, 100);
    recordingTimeout = setTimeout(() => stopVideo('auto'), CAPTURE_VIDEO_MAX_DURATION_MS);
  };

  const updateRecordingClock = (): void => {
    const elapsed = getRecordingElapsed();
    captureState.setElapsed(elapsed);
    if (elapsed >= CAPTURE_VIDEO_MAX_DURATION_MS) {
      stopVideo('auto');
    }
  };

  const stopRecordingClock = (): void => {
    if (recordingTimer !== undefined) {
      clearInterval(recordingTimer);
      recordingTimer = undefined;
    }
    if (recordingTimeout !== undefined) {
      clearTimeout(recordingTimeout);
      recordingTimeout = undefined;
    }
  };

  const getRecordingElapsed = (): number => {
    if (recordingStartedAt === undefined) {
      return recordingDurationMs;
    }
    return Math.min(CAPTURE_VIDEO_MAX_DURATION_MS, performance.now() - recordingStartedAt);
  };

  const openPreview = (asset: CaptureAsset, finalizing = false): void => {
    replaceAsset(asset);
    transientPreviewMessage = finalizing ? 'Preparando o arquivo para compartilhar…' : '';
    captureState.setPreview(asset, finalizing);

    if (!previewPausedAR) {
      previousFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      previewPausedAR = true;
      options.pauseAR();
      queueMicrotask(() => retakeButton.focus());
    }
  };

  const closePreview = (): void => {
    captureOperationId += 1;
    stopRecordingClock();
    recordingStartedAt = undefined;
    stopRequested = false;
    replaceAsset(undefined);
    transientPreviewMessage = '';
    captureState.setReady();
    options.setInteractionLocked(false);

    if (previewPausedAR) {
      previewPausedAR = false;
      options.resumeAR();
    }

    if (previousFocus?.isConnected) {
      previousFocus.focus();
    }
    previousFocus = null;
  };

  const handleSave = (): void => {
    if (!activeAsset?.shareReady) {
      return;
    }

    downloadCaptureAsset(activeAsset);
    options.diagnostics?.recordCapture('download', {
      bytes: activeAsset.bytes,
      kind: activeAsset.kind,
    });
    transientPreviewMessage = 'Arquivo preparado para salvar.';
    renderCaptureSnapshot(captureState.current);
  };

  const handleShare = async (): Promise<void> => {
    const asset = activeAsset;
    if (!asset?.shareReady) {
      return;
    }

    captureState.setSharing();
    options.diagnostics?.recordCapture('share-start', {kind: asset.kind});

    try {
      const result = await shareCaptureAsset(asset);
      options.diagnostics?.recordCapture(
        result === 'shared'
          ? 'share-complete'
          : result === 'cancelled'
            ? 'share-cancelled'
            : 'share-unsupported',
        {kind: asset.kind},
      );
      transientPreviewMessage = result === 'shared'
        ? 'Compartilhamento concluído.'
        : result === 'cancelled'
          ? 'Compartilhamento cancelado.'
          : 'Compartilhamento indisponível. Use Salvar.';
      captureState.restorePreview();
    } catch (error: unknown) {
      options.diagnostics?.recordError('share', error);
      transientPreviewMessage = 'Não foi possível compartilhar. Use Salvar.';
      captureState.restorePreview();
    }
  };

  const replaceAsset = (asset?: CaptureAsset): void => {
    if (activeAsset?.objectUrl !== asset?.objectUrl) {
      disposeCaptureAsset(activeAsset);
    }
    activeAsset = asset;
  };

  const handleCaptureFailure = (error: CaptureError): void => {
    stopRecordingClock();
    recordingStartedAt = undefined;
    stopRequested = false;
    captureOperationId += 1;
    replaceAsset(undefined);
    options.setInteractionLocked(false);
    options.diagnostics?.recordError('capture', error);
    captureState.fail(error);

    if (previewPausedAR) {
      previewPausedAR = false;
      options.resumeAR();
    }
  };

  const prepareIfNeeded = async (snapshot: ARSnapshot): Promise<void> => {
    if (
      destroyed ||
      captureSession ||
      preparePromise ||
      !isTrackingCaptureReady(snapshot)
    ) {
      return;
    }

    captureState.setPreparing();
    preparePromise = options.prepareCapture();

    try {
      captureSession = await preparePromise;
      if (!destroyed) {
        captureState.setReady();
      }
    } catch (error: unknown) {
      if (!destroyed) {
        handleCaptureFailure(
          toCaptureError(
            error,
            'CAPTURE_UNAVAILABLE',
            'A captura não está disponível neste dispositivo.',
          ),
        );
      }
    } finally {
      preparePromise = undefined;
    }
  };

  const handleTrackingSnapshot = (snapshot: ARSnapshot): void => {
    arSnapshot = snapshot;

    synchronizeCaptureTracking(snapshot, {
      prepare: () => void prepareIfNeeded(snapshot),
      render: () => renderCaptureSnapshot(captureState.current),
      reset: () => {
        captureOperationId += 1;
        captureSession = undefined;
        preparePromise = undefined;
        stopRecordingClock();
        replaceAsset(undefined);
        options.setInteractionLocked(false);
        captureState.reset();
      },
    });
  };

  const showFlash = (): void => {
    if (flashTimeout !== undefined) {
      clearTimeout(flashTimeout);
    }
    flash.classList.add('is-visible');
    flashTimeout = setTimeout(() => flash.classList.remove('is-visible'), 140);
  };

  const handlePreviewKeydown = (event: KeyboardEvent): void => {
    if (preview.hidden) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closePreview();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const buttons = [retakeButton, saveButton, shareButton].filter(
      (button) => !button.hidden && !button.disabled,
    );
    const first = buttons[0];
    const last = buttons.at(-1);
    if (!first || !last) {
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const renderCaptureSnapshot = (snapshot: CaptureSnapshot): void => {
    const hasPlacedObject = arSnapshot.placement === 'placed';
    const isPreview = Boolean(snapshot.asset) &&
      (snapshot.phase === 'preview' || snapshot.phase === 'sharing');
    const isBusy = snapshot.phase === 'capturing-photo' ||
      snapshot.phase === 'recording' ||
      snapshot.phase === 'finalizing' ||
      isPreview;
    const canCapture = snapshot.phase === 'ready' && isTrackingCaptureReady(arSnapshot);

    app.dataset.capturePhase = snapshot.phase;
    app.dataset.captureBusy = String(isBusy);
    controls.hidden = !hasPlacedObject || isPreview || snapshot.phase === 'finalizing';
    photoModeButton.disabled = !canCapture;
    videoModeButton.disabled = !canCapture;
    photoModeButton.setAttribute('aria-pressed', String(snapshot.mode === 'photo'));
    videoModeButton.setAttribute('aria-pressed', String(snapshot.mode === 'video'));
    shutterButton.disabled = snapshot.phase === 'recording' ? false : !canCapture;
    shutterButton.setAttribute(
      'aria-label',
      snapshot.phase === 'recording'
        ? 'Parar gravação'
        : snapshot.mode === 'photo'
          ? 'Tirar foto'
          : 'Iniciar gravação de vídeo',
    );
    timer.hidden = snapshot.phase !== 'recording';
    timer.textContent = `${formatDuration(snapshot.elapsedMs)} / 00:10`;
    retryButton.hidden = snapshot.phase !== 'error';
    feedback.textContent = getCaptureFeedback(snapshot, arSnapshot);

    processing.hidden = snapshot.phase !== 'finalizing';
    processingMessage.textContent = 'Preparando vídeo…';
    processingProgress.hidden = snapshot.finalizeProgress === undefined;
    if (snapshot.finalizeProgress !== undefined) {
      processingProgress.value = snapshot.finalizeProgress;
    }

    preview.hidden = !isPreview;
    previewStatus.textContent = transientPreviewMessage ||
      (snapshot.asset?.shareReady ? 'Captura pronta.' : 'Preparando para compartilhar…');
    saveButton.disabled = !snapshot.asset?.shareReady || snapshot.phase === 'sharing';
    shareButton.disabled = !snapshot.asset?.shareReady || snapshot.phase === 'sharing';
    retakeButton.disabled = snapshot.phase === 'sharing';
    shareButton.textContent = snapshot.phase === 'sharing' ? 'Compartilhando…' : 'Compartilhar';

    if (snapshot.asset && renderedAssetUrl !== snapshot.asset.objectUrl) {
      renderedAssetUrl = snapshot.asset.objectUrl;
      previewImage.hidden = snapshot.asset.kind !== 'photo';
      previewVideo.hidden = snapshot.asset.kind !== 'video';
      if (snapshot.asset.kind === 'photo') {
        previewImage.src = snapshot.asset.objectUrl;
        previewVideo.removeAttribute('src');
        previewVideo.load();
      } else {
        previewImage.removeAttribute('src');
        previewVideo.src = snapshot.asset.objectUrl;
        previewVideo.load();
      }
    } else if (!snapshot.asset && renderedAssetUrl) {
      renderedAssetUrl = undefined;
      previewImage.removeAttribute('src');
      previewVideo.removeAttribute('src');
      previewVideo.load();
    }
  };

  const unsubscribeCapture = captureState.subscribe(renderCaptureSnapshot);

  photoModeButton.addEventListener('click', handlePhotoMode);
  videoModeButton.addEventListener('click', handleVideoMode);
  shutterButton.addEventListener('click', handleShutter);
  retryButton.addEventListener('click', handleRetry);
  retakeButton.addEventListener('click', closePreview);
  saveButton.addEventListener('click', handleSave);
  shareButton.addEventListener('click', handleShareClick);
  document.addEventListener('keydown', handlePreviewKeydown);
  window.addEventListener('orientationchange', handleOrientationChange);

  const unsubscribeTracking = options.trackingState.subscribe(handleTrackingSnapshot);

  return {
    handleInterruption(reason): boolean {
      if (captureState.current.phase !== 'recording') {
        return false;
      }
      stopVideo(reason);
      return true;
    },

    shouldKeepARPaused(): boolean {
      return previewPausedAR;
    },

    destroy(): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      captureOperationId += 1;
      if (captureState.current.phase === 'recording') {
        stopVideo('destroy');
      }
      stopRecordingClock();
      if (flashTimeout !== undefined) {
        clearTimeout(flashTimeout);
      }
      if (orientationResumeTimeout !== undefined) {
        clearTimeout(orientationResumeTimeout);
      }
      unsubscribeCapture();
      unsubscribeTracking();
      replaceAsset(undefined);
      options.setInteractionLocked(false);
      photoModeButton.removeEventListener('click', handlePhotoMode);
      videoModeButton.removeEventListener('click', handleVideoMode);
      shutterButton.removeEventListener('click', handleShutter);
      retryButton.removeEventListener('click', handleRetry);
      retakeButton.removeEventListener('click', closePreview);
      saveButton.removeEventListener('click', handleSave);
      shareButton.removeEventListener('click', handleShareClick);
      document.removeEventListener('keydown', handlePreviewKeydown);
      window.removeEventListener('orientationchange', handleOrientationChange);
    },
  };
}

function isTrackingCaptureReady(snapshot: ARSnapshot): boolean {
  return snapshot.phase === 'tracking-ready' && snapshot.placement === 'placed';
}

function getCaptureFeedback(
  snapshot: CaptureSnapshot,
  arSnapshot: ARSnapshot,
): string {
  if (snapshot.error) {
    return snapshot.error.message;
  }
  if (snapshot.phase === 'preparing') {
    return 'Preparando captura…';
  }
  if (snapshot.phase === 'capturing-photo') {
    return 'Capturando foto…';
  }
  if (snapshot.phase === 'recording') {
    return arSnapshot.phase === 'tracking-ready'
      ? ''
      : 'Gravando. Tracking limitado; mova o aparelho devagar.';
  }
  if (arSnapshot.placement === 'placed' && arSnapshot.phase !== 'tracking-ready') {
    return 'Aguarde o tracking estabilizar para capturar.';
  }
  return '';
}

function formatDuration(durationMs: number): string {
  const seconds = Math.min(10, Math.max(0, Math.floor(durationMs / 1000)));
  return `00:${String(seconds).padStart(2, '0')}`;
}

function toCaptureError(
  error: unknown,
  code: CaptureError['code'],
  message: string,
): CaptureError {
  return error instanceof CaptureError
    ? error
    : new CaptureError(code, message, {cause: error});
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Required UI element #${id} was not found.`);
  }
  return element as T;
}
