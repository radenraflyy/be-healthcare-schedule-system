import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { SchedulesService } from '../../src/schedules/schedules.service.js';

function createService(role: 'ADMIN' | 'DOCTOR' | 'CUSTOMER' = 'CUSTOMER') {
  const user = {
    id: 'user-1',
    email: 'customer@example.com',
    name: 'Amani',
    role,
  };
  const doctor = {
    id: '123e4567-e89b-42d3-a456-426614174001',
    userId: 'doctor-user',
    name: 'Demo',
  };
  const customer = {
    id: '123e4567-e89b-42d3-a456-426614174002',
    userId: 'user-1',
    email: user.email,
    name: 'Amani',
  };
  const scheduledAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  scheduledAt.setUTCSeconds(0, 0);
  const minute = scheduledAt.getUTCHours() * 60 + scheduledAt.getUTCMinutes();
  const schedule = {
    id: '123e4567-e89b-42d3-a456-426614174003',
    objective: 'Consultation',
    customerId: customer.id,
    doctorId: doctor.id,
    scheduledAt,
    durationMinutes: 30,
    status: 'REQUESTED',
    customer,
    doctor,
  };
  const prisma = {
    customer: {
      findUnique: vi.fn().mockResolvedValue(customer),
      findFirst: vi.fn().mockResolvedValue(customer),
      create: vi.fn().mockResolvedValue(customer),
      update: vi.fn().mockResolvedValue(customer),
    },
    doctor: { findUnique: vi.fn().mockResolvedValue(doctor) },
    doctorAvailability: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ startMinute: minute, endMinute: minute + 60, slotMinutes: 30 }]),
    },
    schedule: {
      create: vi.fn().mockResolvedValue(schedule),
      findMany: vi.fn().mockResolvedValue([schedule]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(schedule),
      delete: vi.fn().mockResolvedValue(schedule),
      update: vi.fn().mockResolvedValue(schedule),
    },
    scheduleReminder: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
    },
    notification: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
  };
  const tracer = {
    counter: () => ({ increment: vi.fn() }),
    summary: () => ({ observe: vi.fn() }),
    createSpan: (
      _name: string,
      callback: (span: { setTag: (...args: unknown[]) => void }) => unknown,
    ) => callback({ setTag: vi.fn() }),
  };
  const authService = { send: vi.fn(() => of(user)) };
  const reminderQueue = {
    add: vi.fn().mockResolvedValue(1),
    remove: vi.fn().mockResolvedValue(1),
    due: vi.fn().mockResolvedValue([]),
    acquireLock: vi.fn().mockResolvedValue('lock-1'),
    releaseLock: vi.fn().mockResolvedValue(undefined),
  };
  const cache = {
    getOrSet: vi.fn(
      async (_ns: string, _key: unknown, _ttl: number, load: () => Promise<unknown>) => load(),
    ),
    invalidate: vi.fn().mockResolvedValue(undefined),
  };
  const emailQueue = {
    scheduleCreated: vi.fn().mockResolvedValue(undefined),
    scheduleDeleted: vi.fn().mockResolvedValue(undefined),
  };
  return {
    service: new SchedulesService(
      prisma as never,
      tracer as never,
      authService as never,
      reminderQueue as never,
      cache as never,
      emailQueue as never,
    ),
    prisma,
    reminderQueue,
    emailQueue,
    user,
    customer,
    doctor,
    schedule,
    scheduledAt,
  };
}

describe('SchedulesService', () => {
  it('books a valid slot, schedules reminders, and enqueues a customer email', async () => {
    const ctx = createService();
    const result = await ctx.service.createSchedule({
      token: 'jwt',
      input: {
        objective: 'Consultation',
        doctorId: ctx.doctor.id,
        scheduledAt: ctx.scheduledAt,
      },
    });
    expect(result.data).toBe(ctx.schedule);
    expect(ctx.prisma.schedule.create).toHaveBeenCalled();
    expect(ctx.emailQueue.scheduleCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        customerEmail: ctx.customer.email,
        scheduleId: ctx.schedule.id,
      }),
    );
    expect(ctx.prisma.scheduleReminder.createMany).toHaveBeenCalled();
  });

  it('rejects a customer booking outside the doctor availability window', async () => {
    const ctx = createService();
    ctx.prisma.doctorAvailability.findMany.mockResolvedValue([]);
    await expect(
      ctx.service.createSchedule({
        token: 'jwt',
        input: {
          objective: 'Consultation',
          doctorId: ctx.doctor.id,
          scheduledAt: ctx.scheduledAt,
        },
      }),
    ).rejects.toMatchObject({ code: 'BAD_USER_INPUT' });
    expect(ctx.prisma.schedule.create).not.toHaveBeenCalled();
  });

  it('lists schedules scoped to the authenticated customer', async () => {
    const ctx = createService();
    const result = await ctx.service.schedules({
      token: 'jwt',
      input: { page: 1, limit: 5 },
    });
    expect(result.data).toMatchObject({
      items: [ctx.schedule],
      page: 1,
      total: 1,
    });
    expect(ctx.prisma.schedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: ctx.customer.id },
      }),
    );
  });

  it('lets an admin delete a schedule and queues an email after the database delete', async () => {
    const ctx = createService('ADMIN');
    await expect(
      ctx.service.deleteSchedule({
        token: 'jwt',
        input: { id: ctx.schedule.id },
      }),
    ).resolves.toMatchObject({ data: true });
    expect(ctx.prisma.schedule.delete).toHaveBeenCalledWith({
      where: { id: ctx.schedule.id },
    });
    expect(ctx.emailQueue.scheduleDeleted).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleId: ctx.schedule.id }),
    );
  });

  it('returns the authenticated user notifications and marks them read', async () => {
    const ctx = createService();
    await expect(
      ctx.service.notifications({ token: 'jwt', input: { page: 1 } }),
    ).resolves.toMatchObject({
      data: { items: [], total: 0 },
      userId: ctx.user.id,
    });
    await expect(
      ctx.service.markNotificationRead({
        token: 'jwt',
        input: { id: '123e4567-e89b-42d3-a456-426614174000' },
      }),
    ).resolves.toMatchObject({ data: true });
    expect(ctx.prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: ctx.user.id }),
      }),
    );
  });
});
