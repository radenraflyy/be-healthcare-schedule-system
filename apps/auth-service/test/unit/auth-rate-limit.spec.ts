import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRateLimitService } from '../../src/auth/rate-limit.service.js';

const redisMock = vi.hoisted(() => ({
  eval: vi.fn(),
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue('OK'),
}));
vi.mock('ioredis', () => ({
  default: class MockRedis {
    constructor() {
      return redisMock;
    }
  },
}));

describe('AuthRateLimitService', () => {
  beforeEach(() => vi.clearAllMocks());

  function createService() {
    const config = {
      getOrThrow: () => 'redis://localhost:6379',
      get: (_key: string, fallback: number) => fallback,
    };
    return new AuthRateLimitService(config as never);
  }

  it('accepts an attempt within the configured window', async () => {
    redisMock.eval.mockResolvedValue(5);
    await expect(createService().consume('login', 'User@example.com')).resolves.toBeUndefined();
    expect(redisMock.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      expect.stringMatching(/^healthcare:auth-rate:login:/),
      '900000',
    );
  });

  it('rejects attempts above the limit and fails closed if Redis is down', async () => {
    redisMock.eval.mockResolvedValueOnce(6).mockRejectedValueOnce(new Error('offline'));
    const limiter = createService();
    await expect(limiter.consume('login', 'user@example.com')).rejects.toThrow(
      'Terlalu banyak percobaan',
    );
    await expect(limiter.consume('register', 'user@example.com')).rejects.toThrow(
      'sementara tidak tersedia',
    );
  });
});
