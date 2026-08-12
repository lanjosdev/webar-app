import {describe, expect, it} from 'vitest';

import {getCanvasPixelRatio, MAX_CANVAS_PIXEL_RATIO} from './fullWindowCanvas';

describe('getCanvasPixelRatio', () => {
  it('caps high-density mobile displays at two', () => {
    expect(getCanvasPixelRatio(2.75)).toBe(MAX_CANVAS_PIXEL_RATIO);
    expect(getCanvasPixelRatio(3)).toBe(MAX_CANVAS_PIXEL_RATIO);
  });

  it('preserves supported ratios and guards invalid values', () => {
    expect(getCanvasPixelRatio(1.5)).toBe(1.5);
    expect(getCanvasPixelRatio(0.75)).toBe(1);
    expect(getCanvasPixelRatio(Number.NaN)).toBe(1);
  });
});
