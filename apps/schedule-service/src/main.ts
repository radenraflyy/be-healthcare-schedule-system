import { NestFactory } from '@nestjs/core';

import { SCHEDULE_SERVICE_QUEUE } from '../../common/constants/service-tokens.js';
import { rabbitMqServerOptions } from '../../common/rabbitmq/rabbitmq.options.js';
import { ObserveInstrument, ScheduleServiceModule } from './schedule-service.module.js';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(ScheduleServiceModule, {
    instrument: ObserveInstrument,
    ...rabbitMqServerOptions(SCHEDULE_SERVICE_QUEUE),
  });
  app.enableShutdownHooks();
  await app.listen();
}
await bootstrap();
