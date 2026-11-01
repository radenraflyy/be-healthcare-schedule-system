import { NestFactory } from '@nestjs/core';

import { NotificationServiceModule, ObserveInstrument } from './notification-service.module.js';

const app = await NestFactory.createApplicationContext(NotificationServiceModule, {
  instrument: ObserveInstrument,
});
app.enableShutdownHooks();
