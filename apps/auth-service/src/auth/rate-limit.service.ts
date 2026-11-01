import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';

import {
  ServiceUnavailableException,
  TooManyRequestsException,
} from '../../../common/exceptions/index.js';
import {
  redisConnectionOptions,
  resolveRedisUrl,
} from '../../../common/redis/redis-connection.options.js';

const incrementWindowScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return count
`;

@Injectable()
export class AuthRateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthRateLimitService.name);
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis({
      ...redisConnectionOptions(resolveRedisUrl(config)),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.redis.on('error', (error) => {
      this.logger.warn(`Auth rate limiter Redis connection: ${error.message}`);
    });
  }

  async consume(action: 'login' | 'register', identity: string): Promise<void> {
    const normalizedIdentity = identity.trim().toLowerCase();
    const limit = this.config.get<number>(
      action === 'login' ? 'AUTH_LOGIN_RATE_LIMIT' : 'AUTH_REGISTER_RATE_LIMIT',
      action === 'login' ? 5 : 10,
    );
    const windowSeconds = this.config.get<number>(
      action === 'login' ? 'AUTH_LOGIN_RATE_WINDOW_SECONDS' : 'AUTH_REGISTER_RATE_WINDOW_SECONDS',
      action === 'login' ? 900 : 3600,
    );

    let count: number;
    try {
      count = Number(
        await this.redis.eval(
          incrementWindowScript,
          1,
          `healthcare:auth-rate:${action}:${createHash('sha256').update(normalizedIdentity).digest('hex')}`,
          String(windowSeconds * 1000),
        ),
      );
    } catch {
      throw new ServiceUnavailableException(
        'Layanan pembatasan percobaan autentikasi sementara tidak tersedia. Coba lagi sebentar.',
      );
    }

    if (count > limit) {
      throw new TooManyRequestsException(
        action === 'login'
          ? 'Terlalu banyak percobaan login. Coba lagi beberapa menit.'
          : 'Terlalu banyak pendaftaran untuk email ini. Coba lagi nanti.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
