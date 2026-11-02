import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';

import { RabbitMqRpcAckInterceptor } from '../../common/rabbitmq/rabbitmq-rpc-ack.interceptor.js';
import { AuthServiceController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { AuthRateLimitService } from './auth/rate-limit.service.js';
import { TokenRevocationService } from './auth/token-revocation.service.js';
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
  providers: [
    AuthService,
    JwtTokenService,
    AuthRateLimitService,
    TokenRevocationService,
    { provide: APP_INTERCEPTOR, useClass: RabbitMqRpcAckInterceptor },
  ],
})
export class AuthServiceModule {}
