import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';

import {
  redisConnectionOptions,
  resolveRedisUrl,
} from '../../../common/redis/redis-connection.options.js';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      ...redisConnectionOptions(resolveRedisUrl(config)),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (error) => {
      this.logger.warn(`Redis cache unavailable: ${error.message}`);
    });
  }

  async getOrSet<T>(
    namespace: string,
    key: unknown,
    ttlSeconds: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const version = await this.readVersion(namespace);
    const digest = createHash('sha256').update(JSON.stringify(key)).digest('hex');
    const cacheKey = `healthcare:cache:${namespace}:v${version}:${digest}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        try {
          return JSON.parse(cached) as T;
        } catch {
          await this.redis.del(cacheKey);
        }
      }
    } catch {
      return load();
    }

    const result = await load();
    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', ttlSeconds);
    } catch {
      // A cache write should never make a successful database read fail.
    }
    return result;
  }

  async invalidate(...namespaces: string[]): Promise<void> {
    await Promise.all(
      namespaces.map((namespace) =>
        this.redis.incr(`healthcare:cache-version:${namespace}`).catch(() => 0),
      ),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private async readVersion(namespace: string): Promise<number> {
    try {
      return Number((await this.redis.get(`healthcare:cache-version:${namespace}`)) ?? 0);
    } catch {
      return 0;
    }
  }
}
