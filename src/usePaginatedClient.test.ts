import { describe, expect, it } from 'vitest';

import { normalizeId } from './usePaginatedClient';

describe('normalizeId', () => {
  it('strips the drafts. prefix', () => {
    expect(normalizeId('drafts.abc')).toBe('abc');
  });

  it('strips a versions.<release>. prefix', () => {
    expect(normalizeId('versions.summer-drop.abc')).toBe('abc');
  });

  it('leaves a plain id untouched', () => {
    expect(normalizeId('abc')).toBe('abc');
  });
});
