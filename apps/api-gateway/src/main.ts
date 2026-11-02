import { NestFactory } from '@nestjs/core';

import { ApiGatewayModule, ObserveInstrument } from './api-gateway.module.js';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule, {
    instrument: ObserveInstrument,
  });
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    exposedHeaders: [
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'Retry-After',
      'X-Request-Id',
    ],
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_GATEWAY_PORT ?? 3000), '0.0.0.0');
}

await bootstrap();
