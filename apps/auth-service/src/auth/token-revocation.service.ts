import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, type Redis as RedisClient } from 'ioredis';
import { createHash } from 'node:crypto';

import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '../../../common/exceptions/index.js';
import {
  redisConnectionOptions,
  resolveRedisUrl,
} from '../../../common/redis/redis-connection.options.js';

@Injectable()
export class TokenRevocationService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenRevocationService.name);
  private readonly redis: RedisClient;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      ...redisConnectionOptions(resolveRedisUrl(config)),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (error) => {
      this.logger.warn(`Token revocation Redis connection: ${error.message}`);
    });
  }

  async revoke(token: string, expiresAt: number): Promise<void> {
    const ttlSeconds = expiresAt - Math.floor(Date.now() / 1000);
    if (ttlSeconds <= 0) return;

    try {
      await this.redis.set(this.key(token), '1', 'EX', ttlSeconds);
    } catch {
      throw new ServiceUnavailableException(
        'Sesi belum dapat diakhiri karena layanan autentikasi sedang tidak tersedia.',
      );
    }
  }

  async assertNotRevoked(token: string): Promise<void> {
    let revoked: number;
    try {
      revoked = await this.redis.exists(this.key(token));
    } catch {
      throw new ServiceUnavailableException(
        'Sesi belum dapat divalidasi karena layanan autentikasi sedang tidak tersedia.',
      );
    }
    if (revoked) {
      throw new UnauthorizedException('Sesi Anda telah berakhir. Silakan masuk kembali.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private key(token: string): string {
    const digest = createHash('sha256').update(token).digest('hex');
    return `healthcare:auth-revoked:${digest}`;
  }
}
