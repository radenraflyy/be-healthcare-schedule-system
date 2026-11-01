import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { AuthServiceModule, ObserveInstrument } from './auth-service.module.js';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AuthServiceModule, {
    instrument: ObserveInstrument,
    transport: Transport.TCP,
    options: {
      host: process.env.AUTH_SERVICE_BIND_HOST ?? '0.0.0.0',
      port: Number(process.env.AUTH_SERVICE_PORT ?? 3001),
    },
  });
  app.enableShutdownHooks();
  await app.listen();
}
await bootstrap();
