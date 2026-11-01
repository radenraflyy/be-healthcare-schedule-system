import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthService } from './auth-service.service.js';
import { AuthServiceController } from './auth-service.controller.js';
import { JwtTokenService } from './jwt-token.service.js';

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
  providers: [AuthService, JwtTokenService],
})
export class AuthServiceModule {}
