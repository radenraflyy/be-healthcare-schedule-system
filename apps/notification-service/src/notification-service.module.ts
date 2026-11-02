import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';

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
  ],
  controllers: [EmailProcessor],
  providers: [
    SmtpTransportService,
    {
      provide: EmailService,
      inject: [ConfigService, SmtpTransportService],
      useFactory: (config: ConfigService, smtp: SmtpTransportService) =>
        new EmailService(config, smtp),
    },
  ],
})
export class NotificationServiceModule {}
