import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';

import { AuthServiceController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { AuthRateLimitService } from './auth/rate-limit.service.js';
import { JwtTokenService } from './jwt/jwt-token.service.js';
import { PrismaModule } from './prisma/prisma.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'auth-service',
      forwardLogs: true,
    }),
    PrismaModule,
  ],
  controllers: [AuthServiceController],
  providers: [AuthService, JwtTokenService, AuthRateLimitService],
})
export class AuthServiceModule {}
