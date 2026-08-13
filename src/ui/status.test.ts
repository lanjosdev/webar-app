import {describe, expect, it} from 'vitest';

import {getStatusMessage} from './status';

describe('getStatusMessage', () => {
  it('describes the model loading phase', () => {
    expect(getStatusMessage({
      phase: 'loading-model',
      placement: 'not-placed',
    })).toBe('Carregando o modelo 3D…');
  });
});
