import { Injectable } from '@nestjs/common';
import { TracerService } from '@nestjs/observe';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScheduleOperationService } from '../common/schedule-operation.service.js';
import { getPagination, createPage } from '../common/utils/pagination.utils.js';
import {
  requiredText,
  requiredUuid,
  throwPrismaNotFound,
} from '../common/utils/validation.utils.js';
import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import type { DoctorInput } from './dto/doctor.input.js';
import type { PageInput } from '../common/types/pagination.js';

@Injectable()
export class DoctorsService extends ScheduleOperationService {
  constructor(
    prisma: PrismaService,
    tracer: TracerService,
    authService: ClientProxy,
  ) {
    super(prisma, tracer, authService);
  }

  createDoctor(payload: AuthenticatedCommand<DoctorInput>) {
    return this.execute('doctor.create', payload, async (input) => {
      const name = requiredText(input?.name, 'Nama dokter');
      return this.prisma.doctor.create({ data: { name } });
    });
  }

  updateDoctor(payload: AuthenticatedCommand<DoctorInput & { id?: string }>) {
    return this.execute('doctor.update', payload, async (input) => {
      const id = requiredUuid(input?.id, 'ID dokter');
      const name = requiredText(input?.name, 'Nama dokter');
      try {
        return await this.prisma.doctor.update({
          where: { id },
          data: { name },
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
    return this.execute('doctor.delete', payload, async (input) => {
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
}
