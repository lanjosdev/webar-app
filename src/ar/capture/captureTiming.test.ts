import {describe, expect, it} from 'vitest';

import {calculateFinalizationDuration} from './captureTiming';

describe('calculateFinalizationDuration', () => {
  it('measures finalization independently from recording and preview state', () => {
    expect(calculateFinalizationDuration(12_500, 20_250)).toBe(7_750);
  });

  it('returns undefined without valid lifecycle timestamps', () => {
    expect(calculateFinalizationDuration(undefined, 20_250)).toBeUndefined();
    expect(calculateFinalizationDuration(12_500, Number.NaN)).toBeUndefined();
  });

  it('does not report a negative duration for callbacks with equalized clocks', () => {
    expect(calculateFinalizationDuration(20_250, 20_000)).toBe(0);
  });
});
