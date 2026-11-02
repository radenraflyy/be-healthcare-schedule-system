import { NestFactory } from '@nestjs/core';

import { NOTIFICATION_SERVICE_QUEUE } from '../../common/constants/service-tokens.js';
import { rabbitMqServerOptions } from '../../common/rabbitmq/rabbitmq.options.js';
import { NotificationServiceModule, ObserveInstrument } from './notification-service.module.js';

const app = await NestFactory.createMicroservice(NotificationServiceModule, {
  instrument: ObserveInstrument,
  ...rabbitMqServerOptions(NOTIFICATION_SERVICE_QUEUE),
});
app.enableShutdownHooks();
await app.listen();
