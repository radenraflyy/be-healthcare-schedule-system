import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { ObserveInstrument, ScheduleServiceModule } from './schedule-service.module.js';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(ScheduleServiceModule, {
    instrument: ObserveInstrument,
    transport: Transport.TCP,
    options: {
      host: process.env.SCHEDULE_SERVICE_BIND_HOST ?? '0.0.0.0',
      port: Number(process.env.SCHEDULE_SERVICE_PORT ?? 4001),
    },
  });
  app.enableShutdownHooks();
  await app.listen();
}
await bootstrap();
