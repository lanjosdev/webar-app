import {describe, expect, it} from 'vitest';

import {
  serializeDiagnosticsReport,
  type DiagnosticsReport,
} from './diagnostics';

describe('serializeDiagnosticsReport', () => {
  it('produces readable versioned JSON without changing the report', () => {
    const report = {
      capture: {events: []},
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
        schemaVersion: 1,
      },
      runtime: {
        frameCount: 60,
        recoveryCount: 0,
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
