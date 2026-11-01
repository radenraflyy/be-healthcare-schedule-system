import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { createObserveModule } from '@nestjs/observe';
import { CustomersController } from './customers/customers.controller.js';
import { CustomersService } from './customers/customers.service.js';
import { DoctorsController } from './doctors/doctors.controller.js';
import { DoctorsService } from './doctors/doctors.service.js';
import { SchedulesController } from './schedules/schedules.controller.js';
import { SchedulesService } from './schedules/schedules.service.js';
import { HealthController } from './health/health.controller.js';
import { ScheduleHealthService } from './health/health.service.js';
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
    HealthController,
  ],
  providers: [
    CustomersService,
    DoctorsService,
    SchedulesService,
    ScheduleHealthService,
  ],
})
export class ScheduleServiceModule {}
