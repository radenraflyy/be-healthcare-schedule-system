import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { createObserveModule } from '@nestjs/observe';

import { EMAIL_NOTIFICATIONS_QUEUE } from '../../common/constants/queue-names.js';
import {
  redisConnectionOptions,
  resolveRedisUrl,
} from '../../common/redis/redis-connection.options.js';
import { RedisCacheService } from './common/redis-cache.service.js';
import { RedisQueueService } from './common/redis-queue.service.js';
import { ScheduleEmailQueueService } from './common/schedule-email-queue.service.js';
import { CustomersController } from './customers/customers.controller.js';
import { CustomersService } from './customers/customers.service.js';
import { DoctorsController } from './doctors/doctors.controller.js';
import { DoctorsService } from './doctors/doctors.service.js';
import { HealthController } from './health/health.controller.js';
import { ScheduleHealthService } from './health/health.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SchedulesController } from './schedules/schedules.controller.js';
import { SchedulesService } from './schedules/schedules.service.js';
import { WorkflowsController } from './workflows/workflows.controller.js';
import { WorkflowsService } from './workflows/workflows.service.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: redisConnectionOptions(resolveRedisUrl(config)) as never,
      }),
    }),
    BullModule.registerQueue({ name: EMAIL_NOTIFICATIONS_QUEUE }),
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'schedule-service',
      forwardLogs: true,
    }),
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.AUTH_SERVICE_HOST ?? '127.0.0.1',
          port: Number(process.env.AUTH_SERVICE_PORT ?? 3001),
        },
      },
    ]),
    PrismaModule,
  ],
  controllers: [
    CustomersController,
    DoctorsController,
    SchedulesController,
    WorkflowsController,
    HealthController,
  ],
  providers: [
    CustomersService,
    DoctorsService,
    SchedulesService,
    ScheduleHealthService,
    RedisQueueService,
    RedisCacheService,
    ScheduleEmailQueueService,
    WorkflowsService,
  ],
})
export class ScheduleServiceModule {}
