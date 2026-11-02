import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module, RequestMethod } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ClientsModule } from '@nestjs/microservices';
import { createObserveModule } from '@nestjs/observe';
import type { Request, Response } from 'express';

import {
  AUTH_SERVICE,
  AUTH_SERVICE_QUEUE,
  SCHEDULE_SERVICE,
  SCHEDULE_SERVICE_QUEUE,
} from '../../common/constants/service-tokens.js';
import { rabbitMqClientOptions } from '../../common/rabbitmq/rabbitmq.options.js';
import { AuthResolver } from './auth/auth.resolver.js';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware.js';
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
      introspection: true,
      playground:
        process.env.GRAPHQL_PLAYGROUND_ENABLED === 'true' || process.env.NODE_ENV !== 'production',
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
      }),
      formatError: (error) => {
        const extensions = { ...(error.extensions ?? {}) };
        delete extensions.stacktrace;
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
      { name: AUTH_SERVICE, ...rabbitMqClientOptions(AUTH_SERVICE_QUEUE) },
      { name: SCHEDULE_SERVICE, ...rabbitMqClientOptions(SCHEDULE_SERVICE_QUEUE) },
    ]),
  ],
  providers: [AuthResolver, HealthResolver, ScheduleResolver],
})
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggingMiddleware)
      .forRoutes({ path: 'graphql', method: RequestMethod.ALL });
  }
}
