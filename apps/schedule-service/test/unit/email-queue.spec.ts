import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ScheduleEmailQueueService } from '../../src/common/schedule-email-queue.service.js';

describe('ScheduleEmailQueueService', () => {
  it('emits created and deleted email events through RabbitMQ', async () => {
    const notificationService = { emit: vi.fn(() => of(undefined)) };
    const service = new ScheduleEmailQueueService(notificationService as never);
    const job = {
      event: 'created' as const,
      scheduleId: 'schedule-1',
      customerName: 'Amani',
      customerEmail: 'amani@example.com',
      doctorName: 'Dr. Demo',
      objective: 'Consultation',
      scheduledAt: '2026-11-02T09:00:00.000Z',
    };
    await service.scheduleCreated(job);
    expect(notificationService.emit).toHaveBeenCalledWith('notifications.schedule-email', job);
    await service.scheduleDeleted({ ...job, event: 'deleted' });
    expect(notificationService.emit).toHaveBeenLastCalledWith('notifications.schedule-email', {
      ...job,
      event: 'deleted',
    });
  });
});
