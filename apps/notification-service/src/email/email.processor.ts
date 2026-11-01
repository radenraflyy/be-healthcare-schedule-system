import type { OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bull';

import type { ScheduleEmailJob } from '../../../common/types/schedule-email-job.js';
import type { EmailService } from './email.service.js';

export class EmailProcessor implements OnModuleInit {
  constructor(
    private readonly queue: Queue<ScheduleEmailJob>,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit(): void {
    void this.queue.process('schedule-created', (job) =>
      this.process(job as Job<ScheduleEmailJob>),
    );
    void this.queue.process('schedule-deleted', (job) =>
      this.process(job as Job<ScheduleEmailJob>),
    );
  }

  async process(job: Job<ScheduleEmailJob>): Promise<void> {
    await this.emailService.sendScheduleEmail(job.data);
  }
}
