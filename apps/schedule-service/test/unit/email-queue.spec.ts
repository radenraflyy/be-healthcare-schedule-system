import { describe, expect, it, vi } from 'vitest';

import { ScheduleEmailQueueService } from '../../src/common/schedule-email-queue.service.js';

describe('ScheduleEmailQueueService', () => {
  it('queues email jobs with retry and retention settings', async () => {
    const queue = { add: vi.fn().mockResolvedValue({ id: 'job' }) };
    const service = new ScheduleEmailQueueService(queue as never);
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
    expect(queue.add).toHaveBeenCalledWith(
      'schedule-created',
      job,
      expect.objectContaining({
        jobId: 'schedule-created-schedule-1',
        attempts: 5,
      }),
    );
    await service.scheduleDeleted({ ...job, event: 'deleted' });
    expect(queue.add).toHaveBeenLastCalledWith(
      'schedule-deleted',
      { ...job, event: 'deleted' },
      expect.objectContaining({ jobId: 'schedule-deleted-schedule-1' }),
    );
  });
});
