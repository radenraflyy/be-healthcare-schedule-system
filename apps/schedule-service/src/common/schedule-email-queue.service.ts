import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bull';

import { EMAIL_NOTIFICATIONS_QUEUE } from '../../../common/constants/queue-names.js';
import type { ScheduleEmailJob } from '../../../common/types/schedule-email-job.js';

@Injectable()
export class ScheduleEmailQueueService {
  constructor(
    @InjectQueue(EMAIL_NOTIFICATIONS_QUEUE)
    private readonly queue: Queue<ScheduleEmailJob>,
  ) {}

  async scheduleCreated(job: ScheduleEmailJob): Promise<void> {
    await this.enqueue(job, `schedule-created-${job.scheduleId}`);
  }

  async scheduleDeleted(job: ScheduleEmailJob): Promise<void> {
    await this.enqueue(job, `schedule-deleted-${job.scheduleId}`);
  }

  private async enqueue(job: ScheduleEmailJob, jobId: string): Promise<void> {
    await this.queue.add(`schedule-${job.event}`, job, {
      jobId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10000 },
      removeOnFail: { age: 30 * 24 * 60 * 60 },
    });
  }
}
