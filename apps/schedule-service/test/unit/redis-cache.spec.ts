import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RedisCacheService } from '../../src/common/redis-cache.service.js';

const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  incr: vi.fn().mockResolvedValue(1),
  quit: vi.fn().mockResolvedValue('OK'),
  on: vi.fn(),
}));
vi.mock('ioredis', () => ({
  default: class MockRedis {
    constructor() {
      return redisMock;
    }
  },
}));

describe('RedisCacheService', () => {
  beforeEach(() => vi.clearAllMocks());

  function createService() {
    return new RedisCacheService({
      get: (_key: string, fallback?: string) => fallback,
      getOrThrow: () => 'redis://localhost:6379',
    } as never);
  }

  it('loads once then serves the cached result', async () => {
    redisMock.get.mockResolvedValueOnce(null).mockResolvedValueOnce('{"items":[1]}');
    const service = createService();
    const load = vi.fn().mockResolvedValue({ items: [1] });
    await expect(service.getOrSet('schedules', { page: 1 }, 30, load)).resolves.toEqual({
      items: [1],
    });
    await expect(service.getOrSet('schedules', { page: 1 }, 30, load)).resolves.toEqual({
      items: [1],
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(redisMock.set).toHaveBeenCalledWith(
      expect.stringContaining('healthcare:cache:schedules'),
      '{"items":[1]}',
      'EX',
      30,
    );
  });

  it('falls back to the loader when Redis is down and invalidates cache namespaces', async () => {
    redisMock.get.mockRejectedValueOnce(new Error('offline'));
    const service = createService();
    const load = vi.fn().mockResolvedValue(['db']);
    await expect(service.getOrSet('doctors', {}, 15, load)).resolves.toEqual(['db']);
    await expect(service.invalidate('doctors', 'doctor')).resolves.toBeUndefined();
    expect(redisMock.incr).toHaveBeenCalledTimes(2);
    await service.onModuleDestroy();
    expect(redisMock.quit).toHaveBeenCalled();
  });
});
