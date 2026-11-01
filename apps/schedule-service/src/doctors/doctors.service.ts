import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { TracerService } from '@nestjs/observe';

import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import { RedisCacheService } from '../common/redis-cache.service.js';
import { ScheduleOperationService } from '../common/schedule-operation.service.js';
import type { PageInput } from '../common/types/pagination.js';
import { createPage, getPagination } from '../common/utils/pagination.utils.js';
import {
  requiredText,
  requiredUuid,
  throwPrismaNotFound,
} from '../common/utils/validation.utils.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SetAvailabilityInput } from '../schedules/dto/schedule.input.js';
import type { DoctorInput } from './dto/doctor.input.js';

@Injectable()
export class DoctorsService extends ScheduleOperationService {
  constructor(
    prisma: PrismaService,
    tracer: TracerService,
    authService: ClientProxy,
    cache: RedisCacheService,
  ) {
    super(prisma, tracer, authService, cache);
  }

  createDoctor(payload: AuthenticatedCommand<DoctorInput>) {
    return this.execute('doctor.create', payload, async (input, user) => {
      if (user.role !== 'ADMIN')
        throw this.rpc('FORBIDDEN', 'Hanya admin yang dapat mengelola profil dokter.');
      const name = requiredText(input?.name, 'Nama dokter');
      return this.prisma.doctor.create({
        data: { name, userId: input?.userId ?? null },
      });
    });
  }

  updateDoctor(payload: AuthenticatedCommand<DoctorInput & { id?: string }>) {
    return this.execute('doctor.update', payload, async (input, user) => {
      if (user.role !== 'ADMIN')
        throw this.rpc('FORBIDDEN', 'Hanya admin yang dapat mengelola profil dokter.');
      const id = requiredUuid(input?.id, 'ID dokter');
      const name = requiredText(input?.name, 'Nama dokter');
      try {
        return await this.prisma.doctor.update({
          where: { id },
          data: {
            name,
            ...(input.userId !== undefined ? { userId: input.userId || null } : {}),
          },
        });
      } catch (error) {
        throwPrismaNotFound(error, 'Dokter tidak ditemukan.');
        throw error;
      }
    });
  }

  doctors(payload: AuthenticatedCommand<PageInput>) {
    return this.execute('doctor.list', payload, async (input) => {
      const { page, limit, skip } = getPagination(input);
      const [items, total] = await Promise.all([
        this.prisma.doctor.findMany({
          orderBy: { name: 'asc' },
          skip,
          take: limit,
        }),
        this.prisma.doctor.count(),
      ]);
      return createPage(items, page, limit, total);
    });
  }

  doctor(payload: AuthenticatedCommand<{ id?: string }>) {
    return this.execute('doctor.get', payload, async (input) => {
      const id = requiredUuid(input?.id, 'ID dokter');
      const result = await this.prisma.doctor.findUnique({ where: { id } });
      if (!result) throw this.rpc('NOT_FOUND', 'Dokter tidak ditemukan.');
      return result;
    });
  }

  deleteDoctor(payload: AuthenticatedCommand<{ id?: string }>) {
    return this.execute('doctor.delete', payload, async (input, user) => {
      if (user.role !== 'ADMIN')
        throw this.rpc('FORBIDDEN', 'Hanya admin yang dapat mengelola profil dokter.');
      const id = requiredUuid(input?.id, 'ID dokter');
      const doctor = await this.prisma.doctor.findUnique({
        where: { id },
        select: { id: true, _count: { select: { schedules: true } } },
      });
      if (!doctor) throw this.rpc('NOT_FOUND', 'Dokter tidak ditemukan.');
      if (doctor._count.schedules > 0) {
        throw this.rpc(
          'CONFLICT',
          'Dokter masih memiliki jadwal. Hapus jadwal terkait sebelum menghapus dokter.',
        );
      }
      await this.prisma.doctor.delete({ where: { id } });
      return true;
    });
  }

  setAvailability(payload: AuthenticatedCommand<SetAvailabilityInput>) {
    return this.execute('availability.set', payload, async (input, user) => {
      const doctorId = requiredUuid(input?.doctorId, 'ID dokter');
      if (user.role !== 'ADMIN') {
        const doctor = await this.prisma.doctor.findUnique({
          where: { userId: user.id },
        });
        if (user.role !== 'DOCTOR' || doctor?.id !== doctorId) {
          throw this.rpc(
            'FORBIDDEN',
            'Hanya dokter terkait atau admin yang dapat mengubah ketersediaan.',
          );
        }
      }
      const dayOfWeek = Number(input?.dayOfWeek);
      const startMinute = this.timeToMinute(input?.startTime);
      const endMinute = this.timeToMinute(input?.endTime);
      const slotMinutes = Number(input?.slotMinutes ?? 30);
      if (
        !Number.isInteger(dayOfWeek) ||
        dayOfWeek < 0 ||
        dayOfWeek > 6 ||
        startMinute === null ||
        endMinute === null ||
        startMinute >= endMinute ||
        !Number.isInteger(slotMinutes) ||
        slotMinutes < 5 ||
        slotMinutes > 240 ||
        (endMinute - startMinute) % slotMinutes !== 0
      ) {
        throw this.rpc(
          'BAD_USER_INPUT',
          'Hari, rentang waktu, atau durasi slot tidak valid. Waktu menggunakan UTC.',
        );
      }
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId },
      });
      if (!doctor) throw this.rpc('NOT_FOUND', 'Dokter tidak ditemukan.');
      const overlap = await this.prisma.doctorAvailability.findFirst({
        where: {
          doctorId,
          dayOfWeek,
          startMinute: { lt: endMinute },
          endMinute: { gt: startMinute },
        },
      });
      if (overlap)
        throw this.rpc(
          'CONFLICT',
          'Rentang ketersediaan bertabrakan dengan rentang yang sudah ada.',
        );
      const created = await this.prisma.doctorAvailability
        .create({
          data: { doctorId, dayOfWeek, startMinute, endMinute, slotMinutes },
        })
        .catch((error: unknown) => {
          if (this.isOverlapError(error))
            throw this.rpc(
              'CONFLICT',
              'Rentang ketersediaan bertabrakan dengan rentang yang sudah ada.',
            );
          throw error;
        });
      return {
        ...created,
        startTime: this.minuteToTime(created.startMinute),
        endTime: this.minuteToTime(created.endMinute),
      };
    });
  }

  availability(payload: AuthenticatedCommand<{ doctorId?: string; date?: string | Date }>) {
    return this.execute('availability.list', payload, async (input) => {
      const doctorId = requiredUuid(input?.doctorId, 'ID dokter');
      const date = new Date(input?.date ?? '');
      if (Number.isNaN(date.getTime())) throw this.rpc('BAD_USER_INPUT', 'Tanggal tidak valid.');
      const start = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );
      const day = start.getUTCDay();
      const windows = await this.prisma.doctorAvailability.findMany({
        where: { doctorId, dayOfWeek: day },
        orderBy: { startMinute: 'asc' },
      });
      const booked = await this.prisma.schedule.findMany({
        where: {
          doctorId,
          scheduledAt: { gte: start, lt: new Date(start.getTime() + 86400000) },
          status: { not: 'CANCELLED' },
        },
        select: { scheduledAt: true, durationMinutes: true },
      });
      const slots: Date[] = [];
      for (const window of windows) {
        for (
          let minute = window.startMinute;
          minute + window.slotMinutes <= window.endMinute;
          minute += window.slotMinutes
        ) {
          const slot = new Date(start.getTime() + minute * 60000);
          if (slot <= new Date()) continue;
          const slotEnd = slot.getTime() + window.slotMinutes * 60000;
          const occupied = booked.some(
            (item) =>
              slot.getTime() < item.scheduledAt.getTime() + item.durationMinutes * 60000 &&
              slotEnd > item.scheduledAt.getTime(),
          );
          if (!occupied) slots.push(slot);
        }
      }
      return slots;
    });
  }

  availabilityWindows(payload: AuthenticatedCommand<{ doctorId?: string }>) {
    return this.execute('availability.windows', payload, async (input, user) => {
      const doctorId = requiredUuid(input?.doctorId, 'ID dokter');
      if (user.role !== 'ADMIN') {
        const doctor = await this.prisma.doctor.findUnique({
          where: { userId: user.id },
        });
        if (user.role !== 'DOCTOR' || doctor?.id !== doctorId) {
          throw this.rpc('FORBIDDEN', 'Anda tidak memiliki akses ke ketersediaan dokter ini.');
        }
      }
      const items = await this.prisma.doctorAvailability.findMany({
        where: { doctorId },
        orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
      });
      return items.map((item) => ({
        ...item,
        startTime: this.minuteToTime(item.startMinute),
        endTime: this.minuteToTime(item.endMinute),
      }));
    });
  }

  deleteAvailability(payload: AuthenticatedCommand<{ id?: string }>) {
    return this.execute('availability.delete', payload, async (input, user) => {
      const id = requiredUuid(input?.id, 'ID ketersediaan');
      const availability = await this.prisma.doctorAvailability.findUnique({
        where: { id },
        include: { doctor: { select: { userId: true } } },
      });
      if (!availability) throw this.rpc('NOT_FOUND', 'Ketersediaan dokter tidak ditemukan.');
      if (
        user.role !== 'ADMIN' &&
        !(user.role === 'DOCTOR' && availability.doctor.userId === user.id)
      ) {
        throw this.rpc(
          'FORBIDDEN',
          'Hanya dokter terkait atau admin yang dapat mengubah ketersediaan.',
        );
      }
      await this.prisma.doctorAvailability.delete({ where: { id } });
      return true;
    });
  }

  private timeToMinute(value?: string): number | null {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private minuteToTime(value: number): string {
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
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
}
