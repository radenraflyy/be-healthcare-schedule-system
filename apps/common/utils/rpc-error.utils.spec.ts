import { describe, expect, it } from 'vitest';

import { findRpcErrorDetails } from './rpc-error.utils.js';

describe('findRpcErrorDetails', () => {
  it('finds a structured error nested inside a TCP error', () => {
    expect(
      findRpcErrorDetails({
        error: JSON.stringify({ code: 'NOT_FOUND', message: 'Tidak ada.' }),
      }),
    ).toEqual({ code: 'NOT_FOUND', message: 'Tidak ada.' });
  });

  it('returns an empty result for plain errors and safely handles cycles', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.response = cyclic;
    expect(findRpcErrorDetails(cyclic)).toEqual({});
    expect(findRpcErrorDetails(new Error('plain'))).toEqual({});
  });
});
