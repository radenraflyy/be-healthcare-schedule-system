import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailProcessor } from '../../src/email/email.processor.js';
import { EmailService } from '../../src/email/email.service.js';

const job = {
  event: 'created' as const,
  scheduleId: 'schedule-1',
  customerName: 'Amani',
  customerEmail: 'amani@example.com',
  doctorName: 'Demo',
  objective: 'Consultation',
  scheduledAt: '2026-11-02T09:00:00.000Z',
};

describe('notification email worker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('formats and sends created/deleted appointment emails', async () => {
    const config = {
      get: (_key: string, fallback?: string) => fallback,
    };
    const smtp = { sendMail: vi.fn().mockResolvedValue(undefined) };
    const email = new EmailService(config as never, smtp as never);
    await email.sendScheduleEmail(job);
    await email.sendScheduleEmail({ ...job, event: 'deleted' });
    expect(smtp.sendMail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        from: 'Healthcare Schedule <no-reply@healthcare.local>',
        to: job.customerEmail,
        subject: 'Janji temu Anda berhasil dibuat',
        text: expect.stringContaining('dr. Demo'),
      }),
    );
    expect(smtp.sendMail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ subject: 'Janji temu Anda telah dihapus' }),
    );
  });

  it('registers Bull handlers for both appointment events and dispatches jobs', async () => {
    const handlers = new Map<string, (job: unknown) => Promise<void>>();
    const queue = {
      process: vi.fn((name: string, handler: (job: unknown) => Promise<void>) => {
        handlers.set(name, handler);
      }),
    };
    const emailService = {
      sendScheduleEmail: vi.fn().mockResolvedValue(undefined),
    };
    const processor = new EmailProcessor(queue as never, emailService as never);
    processor.onModuleInit();
    await handlers.get('schedule-created')?.({ data: job });
    await handlers.get('schedule-deleted')?.({
      data: { ...job, event: 'deleted' },
    });
    expect(queue.process).toHaveBeenCalledTimes(2);
    expect(emailService.sendScheduleEmail).toHaveBeenCalledTimes(2);
  });
});
