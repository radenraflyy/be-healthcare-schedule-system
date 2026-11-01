import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './auth-service.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  const port = process.env.PORT ?? 3000;
  await app.listen(port, '127.0.0.1');

  Logger.log(`Server running at http://localhost:${port}`, 'Bootstrap');
}
await bootstrap();
