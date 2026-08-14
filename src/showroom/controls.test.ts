import {describe, expect, it} from 'vitest';

import {
  SHOWROOM_AUTO_ROTATE_SPEED,
  SHOWROOM_DAMPING_FACTOR,
  SHOWROOM_MAX_DISTANCE,
  SHOWROOM_MAX_POLAR_ANGLE,
  SHOWROOM_MIN_DISTANCE,
  SHOWROOM_MIN_POLAR_ANGLE,
} from './controls';

describe('showroom control contract', () => {
  it('keeps zoom, orbit and damping inside the mobile composition limits', () => {
    expect(SHOWROOM_MIN_DISTANCE).toBe(1.4);
    expect(SHOWROOM_MAX_DISTANCE).toBe(3.4);
    expect(SHOWROOM_MIN_POLAR_ANGLE).toBeCloseTo(Math.PI * 0.3);
    expect(SHOWROOM_MAX_POLAR_ANGLE).toBeCloseTo(Math.PI * 0.49);
    expect(SHOWROOM_DAMPING_FACTOR).toBe(0.06);
    expect(SHOWROOM_AUTO_ROTATE_SPEED).toBe(2.5);
  });
});
