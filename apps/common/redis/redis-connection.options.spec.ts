import { describe, expect, it } from 'vitest';

import { redisConnectionOptions, resolveRedisUrl } from './redis-connection.options.js';

describe('Redis connection options', () => {
  it('parses credentials, database, and TLS from Redis URLs', () => {
    expect(redisConnectionOptions('redis://user:p%40ss@redis.local:6380/2')).toMatchObject({
      host: 'redis.local',
      port: 6380,
      username: 'user',
      password: 'p@ss',
      db: 2,
    });
    expect(redisConnectionOptions('rediss://cache.local')).toMatchObject({
      host: 'cache.local',
      port: 6379,
      tls: {},
    });
    expect(() => redisConnectionOptions('http://redis.local')).toThrow();
  });

  it('uses the host override outside production and the compose URL in production', () => {
    const config = {
      get: (key: string, fallback?: string) => (key === 'NODE_ENV' ? 'development' : fallback),
      getOrThrow: () => 'redis://redis:6379',
    };
    expect(resolveRedisUrl(config as never)).toBe('redis://redis:6379');
    const localConfig = {
      get: (key: string, fallback?: string) =>
        key === 'NODE_ENV'
          ? 'development'
          : key === 'REDIS_URL_LOCAL'
            ? 'redis://127.0.0.1:6379'
            : fallback,
      getOrThrow: () => 'redis://redis:6379',
    };
    expect(resolveRedisUrl(localConfig as never)).toBe('redis://127.0.0.1:6379');
    const productionConfig = {
      get: () => 'production',
      getOrThrow: () => 'redis://redis:6379',
    };
    expect(resolveRedisUrl(productionConfig as never)).toBe('redis://redis:6379');
  });
});
