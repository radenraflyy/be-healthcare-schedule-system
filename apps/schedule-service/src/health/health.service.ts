import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { TracerService } from '@nestjs/observe';

import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import { RedisCacheService } from '../common/redis-cache.service.js';
import { ScheduleOperationService } from '../common/schedule-operation.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ScheduleHealthService extends ScheduleOperationService {
  constructor(
    prisma: PrismaService,
    tracer: TracerService,
    authService: ClientProxy,
    cache: RedisCacheService,
  ) {
    super(prisma, tracer, authService, cache);
  }

  check(payload: AuthenticatedCommand<Record<string, never>>) {
    return this.execute('health_check', payload, async () => 'Schedule service is healthy');
  }
}
