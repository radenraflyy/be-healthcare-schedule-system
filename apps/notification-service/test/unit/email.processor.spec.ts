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

  it('dispatches RabbitMQ schedule email events to the email service', async () => {
    const emailService = {
      sendScheduleEmail: vi.fn().mockResolvedValue(undefined),
    };
    const processor = new EmailProcessor(emailService as never);
    const channel = {
      assertQueue: vi.fn().mockResolvedValue(undefined),
      ack: vi.fn(),
    };
    const context = {
      getChannelRef: () => channel,
      getMessage: () => ({ properties: { headers: {} } }),
    };
    await processor.process(job, context as never);
    await processor.process({ ...job, event: 'deleted' }, context as never);
    expect(emailService.sendScheduleEmail).toHaveBeenCalledTimes(2);
    expect(emailService.sendScheduleEmail).toHaveBeenNthCalledWith(1, job);
    expect(emailService.sendScheduleEmail).toHaveBeenNthCalledWith(2, {
      ...job,
      event: 'deleted',
    });
    expect(channel.ack).toHaveBeenCalledTimes(2);
  });
});
