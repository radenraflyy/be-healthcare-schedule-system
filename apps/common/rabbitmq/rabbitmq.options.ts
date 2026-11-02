import { Transport } from '@nestjs/microservices';
import type { RmqOptions } from '@nestjs/microservices';

export const RABBITMQ_URL =
  process.env.RABBITMQ_URL ?? 'amqp://healthcare:healthcare-local@127.0.0.1:5672';

export function rabbitMqClientOptions(queue: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [RABBITMQ_URL],
      queue,
      queueOptions: { durable: true },
      persistent: true,
    },
  };
}

export function rabbitMqServerOptions(queue: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [RABBITMQ_URL],
      queue,
      queueOptions: { durable: true },
      noAck: false,
      prefetchCount: 10,
    },
  };
}
