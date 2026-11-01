import type { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

export function resolveRedisUrl(config: ConfigService): string {
  const environment = config.get<string>('NODE_ENV', 'development');
  if (environment !== 'production') {
    const localUrl = config.get<string>('REDIS_URL_LOCAL');
    if (localUrl) return localUrl;
  }
  return config.getOrThrow<string>('REDIS_URL');
}

export function redisConnectionOptions(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use redis:// or rediss://.');
  }

  const database = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  const options: RedisOptions = {
    host: url.hostname,
    port: Number(url.port || 6379),
  };
  if (url.username) options.username = decodeURIComponent(url.username);
  if (url.password) options.password = decodeURIComponent(url.password);
  if (Number.isInteger(database) && database >= 0) options.db = database;
  if (url.protocol === 'rediss:') options.tls = {};
  return options;
}
