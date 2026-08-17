import {describe, expect, it} from 'vitest';

import {createMobileExperienceUrl} from './desktopHandoff';

describe('createMobileExperienceUrl', () => {
  it('keeps the current origin and path', () => {
    expect(
      createMobileExperienceUrl({
        origin: 'https://example.com',
        pathname: '/experience/',
      }, {color: 'silver', finish: 'polished'}),
    ).toBe('https://example.com/experience/?c=silver&f=polished');
  });

  it('does not include query parameters or fragments', () => {
    expect(
      createMobileExperienceUrl({
        origin: 'https://example.com',
        pathname: '/showroom',
      }, {color: 'gold', finish: 'matte'}),
    ).toBe('https://example.com/showroom?c=gold&f=matte');
  });
});
