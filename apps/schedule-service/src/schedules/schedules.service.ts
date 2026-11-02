import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { TracerService } from '@nestjs/observe';

import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import type { ScheduleEmailJob } from '../../../common/types/schedule-email-job.js';
import { RedisCacheService } from '../common/redis-cache.service.js';
import { RedisQueueService } from '../common/redis-queue.service.js';
import { ScheduleEmailQueueService } from '../common/schedule-email-queue.service.js';
import { ScheduleOperationService } from '../common/schedule-operation.service.js';
import type { AuthUser } from '../common/schedule-operation.service.js';
import { createPage, getPagination } from '../common/utils/pagination.utils.js';
import {
  parseDate,
  prismaErrorCode,
  requiredText,
  requiredUuid,
  throwPrismaNotFound,
} from '../common/utils/validation.utils.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateScheduleInput,
  RescheduleInput,
  ScheduleFilterInput,
  SetScheduleStatusInput,
} from './dto/schedule.input.js';

const scheduleInclude = { customer: true, doctor: true } as const;

@Injectable()
export class SchedulesService
  extends ScheduleOperationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SchedulesService.name);
  private reminderTimer?: ReturnType<typeof setInterval>;
  private processingReminders = false;

  constructor(
    prisma: PrismaService,
    tracer: TracerService,
    authService: ClientProxy,
    private readonly reminderQueue: RedisQueueService,
    cache: RedisCacheService,
    private readonly emailQueue: ScheduleEmailQueueService,
  ) {
    super(prisma, tracer, authService, cache);
  }

  onModuleInit(): void {
    this.reminderTimer = setInterval(() => {
      void this.processReminders().catch((error: unknown) => {
        this.logger.error(
          `Reminder worker failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      });
    }, 15000);
    this.reminderTimer.unref?.();
    void this.processReminders().catch((error: unknown) => {
      this.logger.error(
        `Initial reminder worker pass failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    });
  }

  onModuleDestroy(): void {
    if (this.reminderTimer) clearInterval(this.reminderTimer);
  }

  createSchedule(payload: AuthenticatedCommand<CreateScheduleInput>) {
    return this.execute('schedule.create', payload, async (input, user) => {
      const objective = requiredText(input?.objective, 'Tujuan konsultasi');
      let customerId: string;
      if (user.role === 'CUSTOMER') {
        let customer = await this.prisma.customer.findUnique({
          where: { email: user.email },
        });
        if (!customer) {
          customer = await this.prisma.customer.create({
            data: {
              email: user.email,
              name: user.name?.trim() || user.email.split('@')[0],
              userId: user.id,
            },
          });
        } else if (customer.userId && customer.userId !== user.id) {
          throw this.rpc('FORBIDDEN', 'Profil customer ini terhubung ke akun lain.');
        } else if (!customer.userId) {
          customer = await this.prisma.customer.update({
            where: { id: customer.id },
            data: { userId: user.id },
          });
        }
        customerId = customer.id;
      } else {
        if (user.role !== 'ADMIN')
          throw this.rpc('FORBIDDEN', 'Hanya customer atau admin yang dapat membuat janji.');
        customerId = requiredUuid(input?.customerId, 'ID customer');
      }
      const doctorId = requiredUuid(input?.doctorId, 'ID dokter');
      const scheduledAt = parseDate(input?.scheduledAt, 'Waktu jadwal');
      if (scheduledAt <= new Date())
        throw this.rpc('BAD_USER_INPUT', 'Waktu jadwal harus berada di masa depan.');

      const [customer, doctor] = await Promise.all([
        this.prisma.customer.findUnique({
          where: { id: customerId },
          select: { id: true },
        }),
        this.prisma.doctor.findUnique({
          where: { id: doctorId },
          select: { id: true },
        }),
      ]);
      if (!customer) throw this.rpc('NOT_FOUND', 'Customer tidak ditemukan.');
      if (!doctor) throw this.rpc('NOT_FOUND', 'Dokter tidak ditemukan.');

      const durationMinutes = await this.matchAvailability(doctorId, scheduledAt);

      const created = await this.prisma.schedule
        .create({
          data: {
            objective,
            customerId,
            doctorId,
            scheduledAt,
            durationMinutes,
          },
          include: scheduleInclude,
        })
        .catch((error: unknown) => {
          if (prismaErrorCode(error) === 'P2002' || this.isOverlapError(error)) {
            throw this.rpc(
              'CONFLICT',
              'Dokter sudah memiliki jadwal pada waktu tersebut. Pilih waktu lain.',
            );
          }
          throw error;
        });
      const owner = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { userId: true },
      });
      if (owner?.userId) {
        try {
          await this.createReminders(created.id, owner.userId, scheduledAt);
        } catch (error) {
          this.logger.error(
            `Could not schedule reminders for appointment ${created.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
          );
        }
      }
      await this.notifyScheduleParticipants(
        created,
        'Permintaan janji temu baru',
        `Permintaan janji temu dengan dr. ${created.doctor.name} pada ${created.scheduledAt.toISOString()} UTC telah dikirim.`,
        `Permintaan janji temu baru dari ${created.customer.name} pada ${created.scheduledAt.toISOString()} UTC. Tujuan: ${created.objective}.`,
      );
      await this.queueScheduleEmail('created', created);
      return created;
    });
  }

  schedules(payload: AuthenticatedCommand<ScheduleFilterInput>) {
    return this.execute('schedule.list', payload, async (input, user) => {
      const { page, limit, skip } = getPagination(input);
      const customerId =
        user.role === 'CUSTOMER'
          ? (await this.getCustomerForUser(user))?.id
          : input?.customerId
            ? requiredUuid(input.customerId, 'ID customer')
            : undefined;
      const doctorId =
        user.role === 'DOCTOR'
          ? (await this.getDoctorForUser(user))?.id
          : input?.doctorId
            ? requiredUuid(input.doctorId, 'ID dokter')
            : undefined;
      if (user.role === 'CUSTOMER' && !customerId) return createPage([], page, limit, 0);
      if (user.role === 'DOCTOR' && !doctorId) return createPage([], page, limit, 0);
      if (
        (user.role === 'CUSTOMER' && input?.doctorId) ||
        (user.role === 'DOCTOR' && input?.customerId)
      ) {
        throw this.rpc('FORBIDDEN', 'Filter tersebut tidak tersedia untuk role akun ini.');
      }
      const from = input?.from ? parseDate(input.from, 'Tanggal awal') : undefined;
      const to = input?.to ? parseDate(input.to, 'Tanggal akhir') : undefined;
      if (from && to && from > to) {
        throw this.rpc('BAD_USER_INPUT', 'Tanggal awal harus sebelum tanggal akhir.');
      }
      const itemsWhere = {
        ...(customerId ? { customerId } : {}),
        ...(doctorId ? { doctorId } : {}),
        ...(input?.status ? { status: input.status } : {}),
        ...(from || to
          ? {
              scheduledAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        this.prisma.schedule.findMany({
          where: itemsWhere,
          include: scheduleInclude,
          orderBy: { scheduledAt: 'asc' },
          skip,
          take: limit,
        }),
        this.prisma.schedule.count({ where: itemsWhere }),
      ]);
      return createPage(items, page, limit, total);
    });
  }

  schedule(payload: AuthenticatedCommand<{ id?: string }>) {
    return this.execute('schedule.get', payload, async (input, user) => {
      const id = requiredUuid(input?.id, 'ID jadwal');
      const result = await this.prisma.schedule.findUnique({
        where: { id },
        include: scheduleInclude,
      });
      if (!result) throw this.rpc('NOT_FOUND', 'Jadwal tidak ditemukan.');
      this.assertScheduleAccess(result, user);
      return result;
    });
  }

  deleteSchedule(payload: AuthenticatedCommand<{ id?: string }>) {
    return this.execute('schedule.delete', payload, async (input, user) => {
      const id = requiredUuid(input?.id, 'ID jadwal');
      try {
        const existing = await this.prisma.schedule.findUnique({
          where: { id },
          include: scheduleInclude,
        });
        if (!existing) throw this.rpc('NOT_FOUND', 'Jadwal tidak ditemukan.');
        if (user.role !== 'ADMIN')
          throw this.rpc('FORBIDDEN', 'Penghapusan jadwal hanya dapat dilakukan admin.');
        await this.cancelReminders(id);
        await this.notifyScheduleParticipants(
          existing,
          'Janji temu dihapus',
          `Janji temu Anda dengan dr. ${existing.doctor.name} pada ${existing.scheduledAt.toISOString()} UTC telah dihapus oleh admin.`,
          `Janji temu dengan ${existing.customer.name} pada ${existing.scheduledAt.toISOString()} UTC telah dihapus oleh admin.`,
        );
        await this.prisma.schedule.delete({ where: { id } });
        await this.queueScheduleEmail('deleted', existing);
        return true;
      } catch {
        throwPrismaNotFound(error, 'Jadwal tidak ditemukan.');
        throw error;
      }
    });
  }

  updateScheduleStatus(payload: AuthenticatedCommand<SetScheduleStatusInput>) {
    return this.execute('schedule.update_status', payload, async (input, user) => {
      const id = requiredUuid(input?.id, 'ID jadwal');
      if (!['CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(input?.status ?? '')) {
        throw this.rpc('BAD_USER_INPUT', 'Status baru tidak valid.');
      }
      const schedule = await this.prisma.schedule.findUnique({
        where: { id },
        include: scheduleInclude,
      });
      if (!schedule) throw this.rpc('NOT_FOUND', 'Jadwal tidak ditemukan.');
      this.assertScheduleAccess(schedule, user);
      if (schedule.status === 'CANCELLED' || schedule.status === 'COMPLETED') {
        throw this.rpc('CONFLICT', 'Jadwal yang sudah selesai atau dibatalkan tidak dapat diubah.');
      }
      if (input.status === 'CONFIRMED' && user.role !== 'DOCTOR' && user.role !== 'ADMIN') {
        throw this.rpc('FORBIDDEN', 'Hanya dokter atau admin yang dapat mengonfirmasi jadwal.');
      }
      if (input.status === 'COMPLETED' && user.role !== 'DOCTOR' && user.role !== 'ADMIN') {
        throw this.rpc('FORBIDDEN', 'Hanya dokter atau admin yang dapat menyelesaikan jadwal.');
      }
      if (input.status === 'CONFIRMED' && schedule.status !== 'REQUESTED') {
        throw this.rpc('CONFLICT', 'Hanya permintaan baru yang dapat dikonfirmasi.');
      }
      if (input.status === 'CONFIRMED' && schedule.scheduledAt <= new Date()) {
        throw this.rpc('CONFLICT', 'Jadwal yang sudah lewat tidak dapat dikonfirmasi.');
      }
      if (
        input.status === 'COMPLETED' &&
        (schedule.status !== 'CONFIRMED' ||
          schedule.scheduledAt.getTime() + schedule.durationMinutes * 60000 > Date.now())
      ) {
        throw this.rpc(
          'CONFLICT',
          'Jadwal hanya dapat diselesaikan setelah janji terkonfirmasi berlangsung.',
        );
      }
      if (input.status === 'CANCELLED' && user.role === 'CUSTOMER') {
        if (schedule.status !== 'REQUESTED' && schedule.status !== 'CONFIRMED')
          throw this.rpc('FORBIDDEN', 'Jadwal ini tidak dapat dibatalkan customer.');
        if (schedule.scheduledAt.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
          throw this.rpc('CONFLICT', 'Pembatalan harus dilakukan minimal 24 jam sebelum jadwal.');
        }
      }
      const updated = await this.prisma.schedule.update({
        where: { id },
        data: {
          status: input.status,
          cancelReason:
            input.status === 'CANCELLED'
              ? requiredText(input.cancelReason, 'Alasan pembatalan')
              : null,
        },
        include: scheduleInclude,
      });
      if (input.status === 'CANCELLED' || input.status === 'COMPLETED')
        await this.cancelReminders(id);
      if (input.status === 'CONFIRMED') {
        await this.notifyScheduleParticipants(
          updated,
          'Janji temu dikonfirmasi',
          `Janji temu Anda dengan dr. ${updated.doctor.name} telah dikonfirmasi untuk ${updated.scheduledAt.toISOString()} UTC.`,
          `Anda telah mengonfirmasi janji temu dengan ${updated.customer.name} pada ${updated.scheduledAt.toISOString()} UTC.`,
        );
      } else if (input.status === 'CANCELLED') {
        const reason = updated.cancelReason ? ` Alasan: ${updated.cancelReason}` : '';
        await this.notifyScheduleParticipants(
          updated,
          'Janji temu dibatalkan',
          `Janji temu Anda dengan dr. ${updated.doctor.name} pada ${updated.scheduledAt.toISOString()} UTC telah dibatalkan.${reason}`,
          `Janji temu dengan ${updated.customer.name} pada ${updated.scheduledAt.toISOString()} UTC telah dibatalkan.${reason}`,
        );
      } else if (input.status === 'COMPLETED') {
        await this.notifyScheduleParticipants(
          updated,
          'Janji temu selesai',
          `Janji temu Anda dengan dr. ${updated.doctor.name} telah ditandai selesai.`,
          `Janji temu dengan ${updated.customer.name} telah ditandai selesai.`,
        );
      }
      return updated;
    });
  }

  reschedule(payload: AuthenticatedCommand<RescheduleInput>) {
    return this.execute('schedule.reschedule', payload, async (input, user) => {
      const id = requiredUuid(input?.id, 'ID jadwal');
      const scheduledAt = parseDate(input?.scheduledAt, 'Waktu jadwal');
      if (scheduledAt <= new Date())
        throw this.rpc('BAD_USER_INPUT', 'Waktu jadwal harus berada di masa depan.');
      const schedule = await this.prisma.schedule.findUnique({
        where: { id },
        include: scheduleInclude,
      });
      if (!schedule) throw this.rpc('NOT_FOUND', 'Jadwal tidak ditemukan.');
      this.assertScheduleAccess(schedule, user);
      if (user.role === 'DOCTOR')
        throw this.rpc('FORBIDDEN', 'Dokter tidak dapat mengubah waktu janji customer.');
      if (schedule.status !== 'REQUESTED')
        throw this.rpc('CONFLICT', 'Hanya jadwal yang belum dikonfirmasi dapat dijadwalkan ulang.');
      const durationMinutes = await this.matchAvailability(schedule.doctorId, scheduledAt);
      try {
        const updated = await this.prisma.schedule.update({
          where: { id },
          data: { scheduledAt, durationMinutes },
          include: scheduleInclude,
        });
        if (schedule.customer.userId) {
          await this.cancelReminders(id);
          await this.createReminders(id, schedule.customer.userId, scheduledAt);
        }
        await this.notifyScheduleParticipants(
          updated,
          'Jadwal janji temu diubah',
          `Janji temu Anda dengan dr. ${updated.doctor.name} dijadwalkan ulang menjadi ${updated.scheduledAt.toISOString()} UTC.`,
          `Janji temu dengan ${updated.customer.name} dijadwalkan ulang menjadi ${updated.scheduledAt.toISOString()} UTC.`,
        );
        return updated;
      } catch (error) {
        if (this.isOverlapError(error) || prismaErrorCode(error) === 'P2002') {
          throw this.rpc(
            'CONFLICT',
            'Dokter sudah memiliki jadwal pada waktu tersebut. Pilih waktu lain.',
          );
        }
        throw error;
      }
    });
  }

  private async matchAvailability(doctorId: string, scheduledAt: Date): Promise<number> {
    const dayOfWeek = scheduledAt.getUTCDay();
    const minute = scheduledAt.getUTCHours() * 60 + scheduledAt.getUTCMinutes();
    const windows = await this.prisma.doctorAvailability.findMany({
      where: { doctorId, dayOfWeek },
    });
    const window = windows.find(
      (item) =>
        minute >= item.startMinute &&
        minute + item.slotMinutes <= item.endMinute &&
        (minute - item.startMinute) % item.slotMinutes === 0,
    );
    if (!window || scheduledAt.getUTCSeconds() !== 0 || scheduledAt.getUTCMilliseconds() !== 0) {
      throw this.rpc(
        'BAD_USER_INPUT',
        'Waktu tidak sesuai slot ketersediaan dokter (semua jam menggunakan UTC).',
      );
    }
    return window.slotMinutes;
  }

  private async getCustomerForUser(user: AuthUser) {
    return this.prisma.customer.findFirst({
      where: { OR: [{ userId: user.id }, { email: user.email }] },
    });
  }

  private async getDoctorForUser(user: AuthUser) {
    return this.prisma.doctor.findUnique({ where: { userId: user.id } });
  }

  private assertScheduleAccess(
    schedule: {
      customer: { userId: string | null; email: string };
      doctor: { userId: string | null };
    },
    user: AuthUser,
  ) {
    if (user.role === 'ADMIN') return;
    if (
      user.role === 'CUSTOMER' &&
      (schedule.customer.userId === user.id || schedule.customer.email === user.email)
    )
      return;
    if (user.role === 'DOCTOR' && schedule.doctor.userId === user.id) return;
    throw this.rpc('FORBIDDEN', 'Anda tidak memiliki akses ke jadwal ini.');
  }

  private isOverlapError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    if ('code' in error && error.code === '23P01') return true;
    return (
      'meta' in error &&
      typeof error.meta === 'object' &&
      error.meta !== null &&
      'code' in error.meta &&
      error.meta.code === '23P01'
    );
  }

  private async createReminders(
    scheduleId: string,
    userId: string,
    scheduledAt: Date,
  ): Promise<void> {
    const now = new Date();
    const candidates = [
      {
        kind: '24_HOURS',
        remindAt: new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000),
      },
      {
        kind: '1_HOUR',
        remindAt: new Date(scheduledAt.getTime() - 60 * 60 * 1000),
      },
    ].filter((item) => item.remindAt > now);
    const shortNotice = scheduledAt.getTime() - now.getTime() <= 60 * 60 * 1000;
    if (shortNotice) candidates.push({ kind: '1_HOUR', remindAt: now });
    if (candidates.length === 0) return;
    await this.prisma.scheduleReminder.deleteMany({ where: { scheduleId } });
    await this.prisma.scheduleReminder.createMany({
      data: candidates.map((item) => ({ ...item, scheduleId, userId })),
      skipDuplicates: true,
    });
    const reminders = await this.prisma.scheduleReminder.findMany({
      where: { scheduleId, status: 'PENDING' },
      select: { id: true, remindAt: true },
    });
    for (const reminder of reminders) {
      try {
        await this.reminderQueue.add(reminder.id, reminder.remindAt);
      } catch {
        this.logger.warn(`Reminder queued for retry after Redis reconnect (${reminder.id}).`);
      }
    }
  }

  private async queueScheduleEmail(
    event: ScheduleEmailJob['event'],
    schedule: {
      id: string;
      objective: string;
      scheduledAt: Date;
      customer: { name: string; email: string };
      doctor: { name: string };
    },
  ): Promise<void> {
    try {
      const job: ScheduleEmailJob = {
        event,
        scheduleId: schedule.id,
        customerName: schedule.customer.name,
        customerEmail: schedule.customer.email,
        doctorName: schedule.doctor.name,
        objective: schedule.objective,
        scheduledAt: schedule.scheduledAt.toISOString(),
      };
      if (event === 'created') await this.emailQueue.scheduleCreated(job);
      else await this.emailQueue.scheduleDeleted(job);
    } catch (error) {
      this.logger.error(
        `Could not queue ${event} email for schedule ${schedule.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async notifyScheduleParticipants(
    schedule: {
      id: string;
      customer: { userId: string | null };
      doctor: { userId: string | null };
    },
    title: string,
    customerMessage: string,
    doctorMessage: string,
  ): Promise<void> {
    const recipients = new Map<string, string>();
    if (schedule.customer.userId) recipients.set(schedule.customer.userId, customerMessage);
    if (schedule.doctor.userId) recipients.set(schedule.doctor.userId, doctorMessage);
    if (recipients.size === 0) return;

    try {
      await this.prisma.notification.createMany({
        data: [...recipients].map(([userId, message]) => ({
          userId,
          scheduleId: schedule.id,
          title,
          message,
        })),
      });
      await this.cache.invalidate('notification.list');
    } catch (error) {
      this.logger.error(
        `Could not create in-app notification for appointment ${schedule.id}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async cancelReminders(scheduleId: string): Promise<void> {
    const reminders = await this.prisma.scheduleReminder.findMany({
      where: { scheduleId, status: 'PENDING' },
      select: { id: true },
    });
    await this.prisma.scheduleReminder.updateMany({
      where: { scheduleId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    await Promise.all(reminders.map((item) => this.reminderQueue.remove(item.id).catch(() => 0)));
  }

  private async processReminders(): Promise<void> {
    if (this.processingReminders) return;
    this.processingReminders = true;
    try {
      const horizon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const pending = await this.prisma.scheduleReminder.findMany({
        where: { status: 'PENDING', remindAt: { lte: horizon } },
        select: { id: true, remindAt: true },
        orderBy: { remindAt: 'asc' },
      });
      for (const reminder of pending) {
        await this.reminderQueue.add(reminder.id, reminder.remindAt);
      }
      const due = await this.reminderQueue.due(new Date());
      for (const id of due) await this.deliverReminder(id);
    } finally {
      this.processingReminders = false;
    }
  }

  private async deliverReminder(id: string): Promise<void> {
    const lock = await this.reminderQueue.acquireLock(id);
    if (!lock) return;
    try {
      const reminder = await this.prisma.scheduleReminder.findUnique({
        where: { id },
        include: { schedule: { include: { doctor: true } } },
      });
      if (!reminder || reminder.status !== 'PENDING') {
        await this.reminderQueue.remove(id);
        return;
      }
      if (reminder.schedule.status === 'CANCELLED' || reminder.schedule.status === 'COMPLETED') {
        await this.prisma.scheduleReminder.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });
      } else {
        const hours = reminder.kind === '24_HOURS' ? '24 jam' : '1 jam';
        const when = reminder.schedule.scheduledAt.toISOString();
        await this.prisma.$transaction(async (tx) => {
          await tx.notification.upsert({
            where: { sourceReminderId: id },
            create: {
              userId: reminder.userId,
              scheduleId: reminder.scheduleId,
              sourceReminderId: id,
              title: 'Pengingat janji temu',
              message: `Janji temu Anda dengan dr. ${reminder.schedule.doctor.name} dijadwalkan dalam ${hours} (${when} UTC).`,
            },
            update: {},
          });
          await tx.scheduleReminder.update({
            where: { id },
            data: { status: 'SENT', sentAt: new Date() },
          });
        });
      }
      await this.reminderQueue.remove(id);
    } finally {
      await this.reminderQueue.releaseLock(id, lock).catch(() => undefined);
    }
  }

  notifications(payload: AuthenticatedCommand<{ page?: number; limit?: number }>) {
    return this.execute('notification.list', payload, async (input, user) => {
      const { page, limit, skip } = getPagination(input);
      const [items, total] = await Promise.all([
        this.prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.notification.count({ where: { userId: user.id } }),
      ]);
      return createPage(items, page, limit, total);
    });
  }

  markNotificationRead(payload: AuthenticatedCommand<{ id?: string }>) {
    return this.execute('notification.read', payload, async (input, user) => {
      const id = requiredUuid(input?.id, 'ID notifikasi');
      const result = await this.prisma.notification.updateMany({
        where: { id, userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      if (result.count === 0)
        throw this.rpc('NOT_FOUND', 'Notifikasi tidak ditemukan atau sudah dibaca.');
      return true;
    });
  }
}
