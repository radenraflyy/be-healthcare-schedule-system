import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { createObserveModule } from '@nestjs/observe';
import type { Request, Response } from 'express';
import {
  AUTH_SERVICE,
  SCHEDULE_SERVICE,
} from '../../common/constants/service-tokens.js';
import { AuthResolver } from './auth/auth.resolver.js';
import { HealthResolver } from './health/health.resolver.js';
import { ScheduleResolver } from './schedule/schedule.resolver.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'api-gateway',
      forwardLogs: true,
      http: {
        getUserId: (req: { observeUserId?: string }) => req.observeUserId!,
      },
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
      }),
      formatError: (error) => {
        const { stacktrace: _stacktrace, ...extensions } =
          error.extensions ?? {};
        return {
          ...error,
          message:
            error.extensions?.code === 'INTERNAL_SERVER_ERROR'
              ? 'Terjadi kendala pada server. Silakan coba lagi sebentar.'
              : error.message,
          extensions,
        };
      },
    }),
    ClientsModule.register([
      {
        name: AUTH_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.AUTH_SERVICE_HOST ?? '127.0.0.1',
          port: Number(process.env.AUTH_SERVICE_PORT ?? 4002),
        },
      },
      {
        name: SCHEDULE_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.SCHEDULE_SERVICE_HOST ?? '127.0.0.1',
          port: Number(process.env.SCHEDULE_SERVICE_PORT ?? 4001),
        },
      },
    ]),
  ],
  providers: [AuthResolver, HealthResolver, ScheduleResolver],
})
export class ApiGatewayModule {}
