import { NestFactory } from '@nestjs/core';

import { AUTH_SERVICE_QUEUE } from '../../common/constants/service-tokens.js';
import { rabbitMqServerOptions } from '../../common/rabbitmq/rabbitmq.options.js';
import { AuthServiceModule, ObserveInstrument } from './auth-service.module.js';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AuthServiceModule, {
    instrument: ObserveInstrument,
    ...rabbitMqServerOptions(AUTH_SERVICE_QUEUE),
  });
  app.enableShutdownHooks();
  await app.listen();
}
await bootstrap();
