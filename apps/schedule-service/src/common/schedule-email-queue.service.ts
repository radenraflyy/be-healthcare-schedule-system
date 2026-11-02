import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import {
  NOTIFICATION_SERVICE_QUEUE,
  SCHEDULE_EMAIL_EVENT,
} from '../../../common/constants/service-tokens.js';
import type { ScheduleEmailJob } from '../../../common/types/schedule-email-job.js';

@Injectable()
export class ScheduleEmailQueueService {
  constructor(
    @Inject(NOTIFICATION_SERVICE_QUEUE)
    private readonly notificationService: ClientProxy,
  ) {}

  async scheduleCreated(job: ScheduleEmailJob): Promise<void> {
    await this.enqueue(job);
  }

  async scheduleDeleted(job: ScheduleEmailJob): Promise<void> {
    await this.enqueue(job);
  }

  private async enqueue(job: ScheduleEmailJob): Promise<void> {
    await firstValueFrom(this.notificationService.emit(SCHEDULE_EMAIL_EVENT, job));
  }
}
