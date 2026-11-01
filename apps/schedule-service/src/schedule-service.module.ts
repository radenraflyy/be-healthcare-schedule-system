import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { ScheduleServiceController } from './schedule-service.controller.js';
import { ScheduleService } from './schedule-service.service.js';
import { PrismaModule } from './prisma/prisma.module.js';

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
    PrismaModule,
  ],
  controllers: [ScheduleServiceController],
  providers: [ScheduleService],
})
export class ScheduleServiceModule {}
