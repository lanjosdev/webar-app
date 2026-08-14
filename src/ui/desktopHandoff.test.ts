import {describe, expect, it} from 'vitest';

import {createMobileExperienceUrl} from './desktopHandoff';

describe('createMobileExperienceUrl', () => {
  it('keeps the current origin and path', () => {
    expect(
      createMobileExperienceUrl({
        origin: 'https://example.com',
        pathname: '/experience/',
      }),
    ).toBe('https://example.com/experience/');
  });

  it('does not include query parameters or fragments', () => {
    expect(
      createMobileExperienceUrl({
        origin: 'https://example.com',
        pathname: '/showroom',
      }),
    ).toBe('https://example.com/showroom');
  });
});
