import { BullModule, getQueueToken } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import type { Queue } from 'bull';

import { EMAIL_NOTIFICATIONS_QUEUE } from '../../common/constants/queue-names.js';
import {
  redisConnectionOptions,
  resolveRedisUrl,
} from '../../common/redis/redis-connection.options.js';
import { EmailProcessor } from './email/email.processor.js';
import { EmailService } from './email/email.service.js';
import { SmtpTransportService } from './email/smtp-transport.service.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'notification-service',
      forwardLogs: true,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: redisConnectionOptions(resolveRedisUrl(config)) as never,
      }),
    }),
    BullModule.registerQueue({ name: EMAIL_NOTIFICATIONS_QUEUE }),
  ],
  providers: [
    SmtpTransportService,
    {
      provide: EmailService,
      inject: [ConfigService, SmtpTransportService],
      useFactory: (config: ConfigService, smtp: SmtpTransportService) =>
        new EmailService(config, smtp),
    },
    {
      provide: EmailProcessor,
      inject: [getQueueToken(EMAIL_NOTIFICATIONS_QUEUE), EmailService],
      useFactory: (queue: Queue, email: EmailService) => new EmailProcessor(queue, email),
    },
  ],
})
export class NotificationServiceModule {}
