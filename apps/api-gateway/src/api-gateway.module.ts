import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { createObserveModule } from '@nestjs/observe';
import { AUTH_SERVICE, SCHEDULE_SERVICE } from './gateway.constants.js';
import { HealthResolver } from './health.resolver.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'api-gateway',
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
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
  providers: [HealthResolver],
})
export class ApiGatewayModule {}
