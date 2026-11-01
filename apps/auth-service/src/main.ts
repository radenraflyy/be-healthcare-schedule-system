import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuthServiceModule, ObserveInstrument } from './auth-service.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule, {
    instrument: ObserveInstrument,
  });
  const port = process.env.PORT ?? 3000;
  await app.listen(port, '127.0.0.1');

  Logger.log(`Server running at http://localhost:${port}`, 'Bootstrap');
}
await bootstrap();
