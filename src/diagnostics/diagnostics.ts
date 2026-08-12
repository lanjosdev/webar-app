import type {ARSnapshot, TrackingState} from '../ar/tracking/trackingState';
import type {
  CaptureDiagnosticEvent,
  DiagnosticMilestone,
  DiagnosticsSink,
} from './diagnosticsTypes';
import {CaptureMetrics, type CaptureMetricsSnapshot} from './captureMetrics';
import {FrameMetrics} from './frameMetrics';

const LIVE_UPDATE_MS = 500;

interface TimedEvent {
  data?: Record<string, boolean | number | string | undefined>;
  name: string;
  timeMs: number;
}

interface MemoryMetrics {
  jsHeapLimit: number;
  totalJSHeap: number;
  usedJSHeap: number;
}

interface MemorySnapshot extends MemoryMetrics {
  reason: string;
  timeMs: number;
}

export interface DiagnosticsController extends DiagnosticsSink {
  destroy(): void;
  report(): DiagnosticsReport;
}

export interface DiagnosticsReport {
  capture: {
    events: TimedEvent[];
    memory: {
      peakUsedJSHeap?: number;
      snapshots: MemorySnapshot[];
    };
    recordingAverageFps?: number;
    summary: CaptureMetricsSnapshot;
  };
  environment: {
    devicePixelRatio: number;
    effectiveConnection?: string;
    language: string;
    memory?: MemoryMetrics;
    navigationType?: string;
    platform: string;
    screen: {height: number; width: number};
    userAgent: string;
    viewport: {height: number; width: number};
  };
  errors: Array<{message: string; name: string; source: string; timeMs: number}>;
  milestones: Partial<Record<DiagnosticMilestone, number>>;
  observations: {
    connection: string;
    deviceModel: string;
    heating: string;
    lighting: string;
    stability: string;
  };
  resources: Array<{
    durationMs: number;
    name: string;
    transferBytes: number;
  }>;
  run: {
    durationMs: number;
    generatedAt: string;
    id: string;
    mode: string;
    schemaVersion: 2;
  };
  runtime: {
    averageFps?: number;
    frameCount: number;
    p95FrameMs?: number;
    recoveryAverageMs?: number;
    recoveryCount: number;
    intentionalPauses: number;
    resumeRecoveryAverageMs?: number;
    resumeRecoveryCount: number;
    slowFrames: number;
    trackingLosses: number;
  };
  startup: {
    engineAvailableBeforeStart?: boolean;
    navigationToEngineMs?: number;
    startToCameraMs?: number;
    startToEngineMs?: number;
    startToPipelineMs?: number;
    startToSlamMs?: number;
    startToTrackingReadyMs?: number;
  };
  tracking: TimedEvent[];
}

export function isSpontaneousTrackingLoss(
  snapshot: ARSnapshot,
  previousSnapshot: ARSnapshot,
  resumeRecoveryActive: boolean,
): boolean {
  return snapshot.phase === 'tracking-limited' &&
    previousSnapshot.phase !== 'tracking-limited' &&
    !resumeRecoveryActive;
}

export function calculateEngineStartup(
  startTime?: number,
  engineReadyTime?: number,
): Pick<
  DiagnosticsReport['startup'],
  'engineAvailableBeforeStart' | 'startToEngineMs'
> {
  if (startTime === undefined || engineReadyTime === undefined) {
    return {};
  }

  return {
    engineAvailableBeforeStart: engineReadyTime <= startTime,
    startToEngineMs: differenceFromStart(startTime, engineReadyTime),
  };
}

export function createDiagnostics(trackingState: TrackingState): DiagnosticsController {
  const panel = getElement<HTMLElement>('diagnostics-panel');
  const live = getElement<HTMLParagraphElement>('diagnostics-live');
  const copyButton = getElement<HTMLButtonElement>('diagnostics-copy');
  const downloadButton = getElement<HTMLButtonElement>('diagnostics-download');
  const feedback = getElement<HTMLParagraphElement>('diagnostics-feedback');
  const deviceModel = getElement<HTMLInputElement>('diagnostics-device-model');
  const lighting = getElement<HTMLSelectElement>('diagnostics-lighting');
  const connection = getElement<HTMLSelectElement>('diagnostics-connection');
  const heating = getElement<HTMLSelectElement>('diagnostics-heating');
  const stability = getElement<HTMLSelectElement>('diagnostics-stability');
  const startedAt = performance.now();
  const runId = crypto.randomUUID();
  const milestoneTimes = new Map<DiagnosticMilestone, number>();
  const timeline: TimedEvent[] = [];
  const captureEvents: TimedEvent[] = [];
  const captureMetrics = new CaptureMetrics();
  const memorySnapshots: MemorySnapshot[] = [];
  const errors: DiagnosticsReport['errors'] = [];
  const frameMetrics = new FrameMetrics();
  const recoveryDurations: number[] = [];
  const resumeRecoveryDurations: number[] = [];
  let previousSnapshot = trackingState.current;
  let recoveryStartedAt: number | undefined;
  let resumeRecoveryStartedAt: number | undefined;
  let trackingLosses = 0;
  let intentionalPauses = 0;
  let recordingStartFrame = 0;
  let recordingStartTime: number | undefined;
  let destroyed = false;

  panel.hidden = false;

  const elapsed = (): number => performance.now() - startedAt;

  const recordMemory = (reason: string, timeMs = elapsed()): void => {
    const memory = getPerformanceMemory();
    if (memory && memorySnapshots.length < 64) {
      memorySnapshots.push({...memory, reason, timeMs});
    }
  };

  recordMemory('diagnostics-start', 0);

  const mark = (name: DiagnosticMilestone): void => {
    const timeMs = elapsed();
    timeline.push({name, timeMs});
    if (!milestoneTimes.has(name)) {
      milestoneTimes.set(name, timeMs);
    }
    if (name === 'ar-paused' || name === 'ar-resumed') {
      frameMetrics.resetClock();
    }
    if (name === 'ar-paused') {
      intentionalPauses += 1;
    } else if (name === 'ar-resumed') {
      resumeRecoveryStartedAt = timeMs;
    }
  };

  const recordCapture = (
    event: CaptureDiagnosticEvent,
    data?: Record<string, boolean | number | string | undefined>,
  ): void => {
    const timeMs = elapsed();
    let eventData = data;

    if (event === 'video-start') {
      recordingStartFrame = frameMetrics.frameCount;
      recordingStartTime = performance.now();
    } else if (event === 'video-stop' && recordingStartTime !== undefined) {
      const durationMs = typeof data?.durationMs === 'number'
        ? data.durationMs
        : performance.now() - recordingStartTime;
      const recordedFrames = frameMetrics.frameCount - recordingStartFrame;
      const recordingAverageFps = durationMs > 0
        ? recordedFrames * 1000 / durationMs
        : undefined;
      eventData = {
        ...data,
        averageFps: optionalRound(recordingAverageFps),
      };
      recordingStartTime = undefined;
    }

    captureMetrics.record(event, eventData);
    captureEvents.push({data: eventData, name: event, timeMs});
    if (
      event === 'photo-start' ||
      event === 'photo-ready' ||
      event === 'video-start' ||
      event === 'video-ready' ||
      event === 'discard'
    ) {
      recordMemory(event, timeMs);
    }
  };

  const recordError = (source: 'ar' | 'capture' | 'share', error: unknown): void => {
    const normalized = normalizeError(error);
    errors.push({...normalized, source, timeMs: elapsed()});
  };

  const recordFrame = (now = performance.now()): void => {
    frameMetrics.record(now);
  };

  const handleTracking = (snapshot: ARSnapshot): void => {
    const now = elapsed();
    if (
      snapshot.phase !== previousSnapshot.phase ||
      snapshot.placement !== previousSnapshot.placement
    ) {
      timeline.push({
        data: {phase: snapshot.phase, placement: snapshot.placement},
        name: 'tracking-state',
        timeMs: now,
      });
    }

    if (snapshot.phase === 'tracking-ready') {
      if (!milestoneTimes.has('tracking-ready')) {
        mark('tracking-ready');
      }
      if (recoveryStartedAt !== undefined) {
        recoveryDurations.push(now - recoveryStartedAt);
        recoveryStartedAt = undefined;
      }
      if (resumeRecoveryStartedAt !== undefined) {
        resumeRecoveryDurations.push(now - resumeRecoveryStartedAt);
        resumeRecoveryStartedAt = undefined;
      }
    } else if (isSpontaneousTrackingLoss(
      snapshot,
      previousSnapshot,
      resumeRecoveryStartedAt !== undefined,
    )) {
      trackingLosses += 1;
      recoveryStartedAt = now;
    }

    if (snapshot.placement === 'placed' && !milestoneTimes.has('first-placement')) {
      mark('first-placement');
    }

    previousSnapshot = snapshot;
  };

  const unsubscribe = trackingState.subscribe(handleTracking);

  const report = (): DiagnosticsReport => {
    const startTime = milestoneTimes.get('start-intent');
    const durationMs = elapsed();
    const resources = performance
      .getEntriesByType('resource')
      .filter((entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming)
      .filter((entry) => /(?:xr(?:-slam)?\.js)/.test(entry.name))
      .map((entry) => ({
        durationMs: round(entry.duration),
        name: new URL(entry.name).pathname,
        transferBytes: entry.transferSize,
      }));
    const navigation = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    const memory = getPerformanceMemory();
    const reportMemorySnapshots = [...memorySnapshots];
    if (memory) {
      reportMemorySnapshots.push({...memory, reason: 'report', timeMs: durationMs});
    }
    const effectiveConnection = getEffectiveConnection();
    const frames = frameMetrics.snapshot();
    const captureSummary = captureMetrics.snapshot();
    const engineReadyTime = milestoneTimes.get('engine-ready');
    const engineStartup = calculateEngineStartup(startTime, engineReadyTime);

    return {
      capture: {
        events: [...captureEvents],
        memory: {
          peakUsedJSHeap: reportMemorySnapshots.length > 0
            ? Math.max(...reportMemorySnapshots.map((snapshot) => snapshot.usedJSHeap))
            : undefined,
          snapshots: reportMemorySnapshots,
        },
        recordingAverageFps: captureSummary.videos.fps.average,
        summary: captureSummary,
      },
      environment: {
        devicePixelRatio: window.devicePixelRatio,
        effectiveConnection,
        language: navigator.language,
        memory,
        navigationType: navigation?.type,
        platform: navigator.platform,
        screen: {height: window.screen.height, width: window.screen.width},
        userAgent: navigator.userAgent,
        viewport: {height: window.innerHeight, width: window.innerWidth},
      },
      errors: [...errors],
      milestones: Object.fromEntries(milestoneTimes),
      observations: {
        connection: connection.value,
        deviceModel: deviceModel.value.trim(),
        heating: heating.value,
        lighting: lighting.value,
        stability: stability.value,
      },
      resources,
      run: {
        durationMs: round(durationMs),
        generatedAt: new Date().toISOString(),
        id: runId,
        mode: import.meta.env.MODE,
        schemaVersion: 2,
      },
      runtime: {
        averageFps: frames.averageFps,
        frameCount: frames.frameCount,
        p95FrameMs: frames.p95FrameMs,
        recoveryAverageMs: recoveryDurations.length > 0
          ? round(recoveryDurations.reduce((sum, value) => sum + value, 0) /
              recoveryDurations.length)
          : undefined,
        recoveryCount: recoveryDurations.length,
        intentionalPauses,
        resumeRecoveryAverageMs: average(resumeRecoveryDurations),
        resumeRecoveryCount: resumeRecoveryDurations.length,
        slowFrames: frames.slowFrames,
        trackingLosses,
      },
      startup: {
        ...engineStartup,
        navigationToEngineMs: absolutePerformanceTime(
          startedAt,
          milestoneTimes.get('engine-ready'),
        ),
        startToCameraMs: differenceFrom(startTime, milestoneTimes.get('camera-video')),
        startToPipelineMs: differenceFrom(startTime, milestoneTimes.get('pipeline-start')),
        startToSlamMs: differenceFrom(startTime, milestoneTimes.get('slam-ready')),
        startToTrackingReadyMs: differenceFrom(
          startTime,
          milestoneTimes.get('tracking-ready'),
        ),
      },
      tracking: [...timeline],
    };
  };

  const updateLive = (): void => {
    const fps = frameMetrics.snapshot().averageFps?.toFixed(1) ?? '—';
    const start = milestoneTimes.get('start-intent');
    const ready = differenceFrom(start, milestoneTimes.get('tracking-ready'));
    live.textContent = `Tempo ${formatElapsed(elapsed())} · FPS ${fps} · ` +
      `tracking ${ready === undefined ? 'aguardando' : `${Math.round(ready)} ms`}`;
  };

  const copyReport = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(serializeDiagnosticsReport(report()));
      feedback.textContent = 'Relatório copiado.';
    } catch (error: unknown) {
      recordError('capture', error);
      feedback.textContent = 'Não foi possível copiar. Use Baixar JSON.';
    }
  };

  const downloadReport = (): void => {
    const blob = new Blob([serializeDiagnosticsReport(report())], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `webar-diagnostics-${runId}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    feedback.textContent = 'Relatório preparado para download.';
  };

  const handleCopyClick = (): void => void copyReport();
  copyButton.addEventListener('click', handleCopyClick);
  downloadButton.addEventListener('click', downloadReport);
  const liveInterval = setInterval(updateLive, LIVE_UPDATE_MS);
  updateLive();

  return {
    mark,
    recordCapture,
    recordError,
    recordFrame,
    report,
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      clearInterval(liveInterval);
      unsubscribe();
      panel.hidden = true;
      copyButton.removeEventListener('click', handleCopyClick);
      downloadButton.removeEventListener('click', downloadReport);
    },
  };
}

export function serializeDiagnosticsReport(report: DiagnosticsReport): string {
  return JSON.stringify(report, null, 2);
}

function differenceFrom(start?: number, end?: number): number | undefined {
  return start === undefined || end === undefined ? undefined : round(end - start);
}

function differenceFromStart(start?: number, end?: number): number | undefined {
  if (start === undefined || end === undefined) {
    return undefined;
  }
  return round(Math.max(0, end - start));
}

function getPerformanceMemory(): DiagnosticsReport['environment']['memory'] {
  const memory = (performance as Performance & {
    memory?: {jsHeapSizeLimit: number; totalJSHeapSize: number; usedJSHeapSize: number};
  }).memory;
  return memory
    ? {
        jsHeapLimit: memory.jsHeapSizeLimit,
        totalJSHeap: memory.totalJSHeapSize,
        usedJSHeap: memory.usedJSHeapSize,
      }
    : undefined;
}

function getEffectiveConnection(): string | undefined {
  return (navigator as Navigator & {connection?: {effectiveType?: string}}).connection
    ?.effectiveType;
}

function normalizeError(error: unknown): {message: string; name: string} {
  if (error instanceof Error) {
    return {message: error.message, name: error.name};
  }
  return {message: String(error), name: 'UnknownError'};
}

function optionalRound(value?: number): number | undefined {
  return value === undefined ? undefined : round(value);
}

function average(values: number[]): number | undefined {
  return values.length === 0
    ? undefined
    : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function absolutePerformanceTime(origin: number, elapsedTime?: number): number | undefined {
  return elapsedTime === undefined ? undefined : round(origin + elapsedTime);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatElapsed(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Required diagnostics element #${id} was not found.`);
  }
  return element as T;
}
