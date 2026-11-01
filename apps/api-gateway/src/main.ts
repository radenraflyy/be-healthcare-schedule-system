import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule, ObserveInstrument } from './api-gateway.module.js';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule, {
    instrument: ObserveInstrument,
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_GATEWAY_PORT ?? 3000), '0.0.0.0');
}

await bootstrap();
