import { Injectable } from '@nestjs/common';
import { TracerService } from '@nestjs/observe';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import { ScheduleOperationService } from '../common/schedule-operation.service.js';

@Injectable()
export class ScheduleHealthService extends ScheduleOperationService {
  constructor(
    prisma: PrismaService,
    tracer: TracerService,
    authService: ClientProxy,
  ) {
    super(prisma, tracer, authService);
  }

  check(payload: AuthenticatedCommand<Record<string, never>>) {
    return this.execute(
      'health_check',
      payload,
      async () => 'Schedule service is healthy',
    );
  }
}
