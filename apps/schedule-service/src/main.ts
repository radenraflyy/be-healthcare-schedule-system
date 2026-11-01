import { NestFactory } from '@nestjs/core';
import { ScheduleServiceModule } from './schedule-service.module.js';

async function bootstrap() {
  const app = await NestFactory.create(ScheduleServiceModule);
  await app.listen(process.env.port ?? 3000);
}
await bootstrap();
