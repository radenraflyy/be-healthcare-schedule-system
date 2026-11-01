import { Injectable } from '@nestjs/common';
import { TracerService } from '@nestjs/observe';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScheduleOperationService } from '../common/schedule-operation.service.js';
import { getPagination, createPage } from '../common/utils/pagination.utils.js';
import {
  requiredText,
  requiredUuid,
  parseDate,
  prismaErrorCode,
  throwPrismaNotFound,
} from '../common/utils/validation.utils.js';
import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import type {
  CreateScheduleInput,
  ScheduleFilterInput,
} from './dto/schedule.input.js';
const scheduleInclude = { customer: true, doctor: true } as const;

@Injectable()
export class SchedulesService extends ScheduleOperationService {
  constructor(
    prisma: PrismaService,
    tracer: TracerService,
    authService: ClientProxy,
  ) {
    super(prisma, tracer, authService);
  }

  createSchedule(payload: AuthenticatedCommand<CreateScheduleInput>) {
    return this.execute('schedule.create', payload, async (input) => {
      const objective = requiredText(input?.objective, 'Tujuan konsultasi');
      const customerId = requiredUuid(input?.customerId, 'ID customer');
      const doctorId = requiredUuid(input?.doctorId, 'ID dokter');
      const scheduledAt = parseDate(input?.scheduledAt, 'Waktu jadwal');

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

      try {
        return await this.prisma.schedule.create({
          data: { objective, customerId, doctorId, scheduledAt },
          include: scheduleInclude,
        });
      } catch (error) {
        if (prismaErrorCode(error) === 'P2002') {
          throw this.rpc(
            'CONFLICT',
            'Dokter sudah memiliki jadwal pada waktu tersebut. Pilih waktu lain.',
          );
        }
        throw error;
      }
    });
  }

  schedules(payload: AuthenticatedCommand<ScheduleFilterInput>) {
    return this.execute('schedule.list', payload, async (input) => {
      const { page, limit, skip } = getPagination(input);
      const customerId = input?.customerId
        ? requiredUuid(input.customerId, 'ID customer')
        : undefined;
      const doctorId = input?.doctorId
        ? requiredUuid(input.doctorId, 'ID dokter')
        : undefined;
      const from = input?.from
        ? parseDate(input.from, 'Tanggal awal')
        : undefined;
      const to = input?.to ? parseDate(input.to, 'Tanggal akhir') : undefined;
      if (from && to && from > to) {
        throw this.rpc(
          'BAD_USER_INPUT',
          'Tanggal awal harus sebelum tanggal akhir.',
        );
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
    return this.execute('schedule.get', payload, async (input) => {
      const id = requiredUuid(input?.id, 'ID jadwal');
      const result = await this.prisma.schedule.findUnique({
        where: { id },
        include: scheduleInclude,
      });
      if (!result) throw this.rpc('NOT_FOUND', 'Jadwal tidak ditemukan.');
      return result;
    });
  }

  deleteSchedule(payload: AuthenticatedCommand<{ id?: string }>) {
    return this.execute('schedule.delete', payload, async (input) => {
      const id = requiredUuid(input?.id, 'ID jadwal');
      try {
        await this.prisma.schedule.delete({ where: { id } });
        return true;
      } catch (error) {
        throwPrismaNotFound(error, 'Jadwal tidak ditemukan.');
        throw error;
      }
    });
  }
}
