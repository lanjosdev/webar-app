import {describe, expect, it} from 'vitest';

import {
  calculateEngineStartup,
  isSpontaneousTrackingLoss,
  serializeDiagnosticsReport,
  type DiagnosticsReport,
} from './diagnostics';

describe('serializeDiagnosticsReport', () => {
  it('produces readable versioned JSON without changing the report', () => {
    const report = {
      capture: {
        events: [],
        memory: {snapshots: []},
        summary: {
          discards: 0,
          photos: {
            bytes: {count: 0},
            latencyMs: {count: 0},
            ready: 0,
          },
          videos: {
            backgroundFinalizations: 0,
            blockedStarts: 0,
            bytes: {count: 0},
            finalizationMs: {count: 0},
            fps: {count: 0},
            ready: 0,
            started: 0,
            stopped: 0,
          },
        },
      },
      environment: {
        devicePixelRatio: 2,
        language: 'pt-BR',
        platform: 'test',
        screen: {height: 844, width: 390},
        userAgent: 'test-agent',
        viewport: {height: 700, width: 390},
      },
      errors: [],
      milestones: {},
      observations: {
        connection: 'wifi',
        deviceModel: 'Test phone',
        heating: 'none',
        lighting: 'good',
        stability: 'stable',
      },
      resources: [],
      run: {
        durationMs: 1_000,
        generatedAt: '2026-08-11T12:00:00.000Z',
        id: 'run-id',
        mode: 'test',
        schemaVersion: 2,
      },
      runtime: {
        frameCount: 60,
        intentionalPauses: 0,
        recoveryCount: 0,
        resumeRecoveryCount: 0,
        slowFrames: 0,
        trackingLosses: 0,
      },
      startup: {},
      tracking: [],
    } satisfies DiagnosticsReport;

    const serialized = serializeDiagnosticsReport(report);

    expect(serialized).toContain('\n  "run": {');
    expect(JSON.parse(serialized)).toEqual(report);
  });
});

describe('diagnostics classification', () => {
  it('reports an Engine that loaded before the user gesture without a negative duration', () => {
    expect(calculateEngineStartup(5_000, 800)).toEqual({
      engineAvailableBeforeStart: true,
      startToEngineMs: 0,
    });
    expect(calculateEngineStartup(800, 1_300)).toEqual({
      engineAvailableBeforeStart: false,
      startToEngineMs: 500,
    });
  });

  it('does not classify recovery from an intentional pause as tracking loss', () => {
    const previous = {phase: 'tracking-recovering', placement: 'placed'} as const;
    const limited = {phase: 'tracking-limited', placement: 'placed'} as const;

    expect(isSpontaneousTrackingLoss(limited, previous, true)).toBe(false);
    expect(isSpontaneousTrackingLoss(limited, previous, false)).toBe(true);
  });
});
