import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';

import {
  NOTIFICATION_SERVICE_QUEUE,
  SCHEDULE_EMAIL_EVENT,
} from '../../../common/constants/service-tokens.js';
import type { ScheduleEmailJob } from '../../../common/types/schedule-email-job.js';
import { EmailService } from './email.service.js';

const RETRY_COUNT_HEADER = 'x-healthcare-email-retry-count';
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 80_000];
const RETRY_QUEUE_PREFIX = `${NOTIFICATION_SERVICE_QUEUE}.retry`;
const DEAD_LETTER_QUEUE = `${NOTIFICATION_SERVICE_QUEUE}.dead-letter`;

@Controller()
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly topologyByChannel = new WeakMap<Channel, Promise<void>>();

  constructor(private readonly emailService: EmailService) {}

  @EventPattern(SCHEDULE_EMAIL_EVENT)
  async process(@Payload() job: ScheduleEmailJob, @Ctx() context: RmqContext): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;

    await this.ensureRetryTopology(channel);

    try {
      await this.emailService.sendScheduleEmail(job);
      channel.ack(message);
    } catch (error) {
      await this.retryOrDeadLetter(channel, message, job, error);
    }
  }

  private ensureRetryTopology(channel: Channel): Promise<void> {
    const existing = this.topologyByChannel.get(channel);
    if (existing) return existing;

    const topology = this.createRetryTopology(channel).catch((error: unknown) => {
      this.topologyByChannel.delete(channel);
      throw error;
    });
    this.topologyByChannel.set(channel, topology);
    return topology;
  }

  private async createRetryTopology(channel: Channel): Promise<void> {
    await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });

    await Promise.all(
      RETRY_DELAYS_MS.map((messageTtl, index) =>
        channel.assertQueue(`${RETRY_QUEUE_PREFIX}.${index + 1}`, {
          durable: true,
          messageTtl,
          deadLetterExchange: '',
          deadLetterRoutingKey: NOTIFICATION_SERVICE_QUEUE,
        }),
      ),
    );
  }

  private async retryOrDeadLetter(
    channel: Channel,
    message: ConsumeMessage,
    job: ScheduleEmailJob,
    error: unknown,
  ): Promise<void> {
    const retryCount = Number(message.properties.headers?.[RETRY_COUNT_HEADER] ?? 0);
    const headers = {
      ...message.properties.headers,
      [RETRY_COUNT_HEADER]: retryCount + 1,
    };
    const publishOptions = {
      ...message.properties,
      headers,
      persistent: true,
    };

    if (retryCount < RETRY_DELAYS_MS.length) {
      const retryQueue = `${RETRY_QUEUE_PREFIX}.${retryCount + 1}`;
      channel.sendToQueue(retryQueue, message.content, publishOptions);
      channel.ack(message);
      this.logger.warn(
        `Email event for schedule ${job.scheduleId} failed; retry ${retryCount + 1}/${RETRY_DELAYS_MS.length} queued.`,
      );
      return;
    }

    channel.sendToQueue(DEAD_LETTER_QUEUE, message.content, publishOptions);
    channel.ack(message);
    this.logger.error(
      `Email event for schedule ${job.scheduleId} moved to ${DEAD_LETTER_QUEUE}.`,
      error instanceof Error ? error.stack : String(error),
    );
  }
}
