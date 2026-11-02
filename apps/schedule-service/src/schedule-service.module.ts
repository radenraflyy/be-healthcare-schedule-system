import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClientsModule } from '@nestjs/microservices';
import { createObserveModule } from '@nestjs/observe';

import {
  AUTH_SERVICE,
  AUTH_SERVICE_QUEUE,
  NOTIFICATION_SERVICE_QUEUE,
} from '../../common/constants/service-tokens.js';
import { RabbitMqRpcAckInterceptor } from '../../common/rabbitmq/rabbitmq-rpc-ack.interceptor.js';
import { rabbitMqClientOptions } from '../../common/rabbitmq/rabbitmq.options.js';
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
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'schedule-service',
      forwardLogs: true,
    }),
    ClientsModule.register([
      {
        name: AUTH_SERVICE,
        ...rabbitMqClientOptions(AUTH_SERVICE_QUEUE),
      },
      {
        name: NOTIFICATION_SERVICE_QUEUE,
        ...rabbitMqClientOptions(NOTIFICATION_SERVICE_QUEUE),
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
    { provide: APP_INTERCEPTOR, useClass: RabbitMqRpcAckInterceptor },
  ],
})
export class ScheduleServiceModule {}
