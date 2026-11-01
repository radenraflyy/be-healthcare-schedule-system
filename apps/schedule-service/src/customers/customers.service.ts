import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { TracerService } from '@nestjs/observe';

import { BadRequestException } from '../../../common/exceptions/index.js';
import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import { RedisCacheService } from '../common/redis-cache.service.js';
import { ScheduleOperationService } from '../common/schedule-operation.service.js';
import type { PageInput } from '../common/types/pagination.js';
import { createPage, getPagination } from '../common/utils/pagination.utils.js';
import {
  normalizeEmail,
  parseDate,
  prismaErrorCode,
  requiredText,
  requiredUuid,
  throwPrismaNotFound,
} from '../common/utils/validation.utils.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CustomerInput } from './dto/customer.input.js';

function optionalText(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${label} harus berupa teks.`);
  }
  const text = value.trim();
  if (!text) return null;
  if (text.length > maxLength) {
    throw new BadRequestException(`${label} maksimal ${maxLength} karakter.`);
  }
  return text;
}

function optionalDate(value: string | Date | null | undefined, label: string) {
  if (value === undefined || value === null) return value;
  return parseDate(value, label);
}

@Injectable()
export class CustomersService extends ScheduleOperationService {
  constructor(
    prisma: PrismaService,
    tracer: TracerService,
    authService: ClientProxy,
    cache: RedisCacheService,
  ) {
    super(prisma, tracer, authService, cache);
  }

  createCustomer(payload: AuthenticatedCommand<CustomerInput>) {
    return this.execute('customer.create', payload, async (input, user) => {
      if (user.role !== 'ADMIN')
        throw this.rpc('FORBIDDEN', 'Hanya admin yang dapat mengelola profil customer.');
      const name = requiredText(input?.name, 'Nama customer');
      const email = normalizeEmail(input?.email);
      try {
        return await this.prisma.customer.create({
          data: {
            name,
            email,
            userId: input?.userId ?? null,
            phone: optionalText(input?.phone, 'Nomor telepon', 40),
            gender: optionalText(input?.gender, 'Jenis kelamin', 40),
            birthDate: optionalDate(input?.birthDate, 'Tanggal lahir'),
            address: optionalText(input?.address, 'Alamat', 300),
            treatment: optionalText(input?.treatment, 'Jenis perawatan', 120),
            status: input?.status,
            nextVisit: optionalDate(input?.nextVisit, 'Jadwal kunjungan'),
            note: optionalText(input?.note, 'Catatan', 2000),
          },
        });
      } catch (error) {
        if (prismaErrorCode(error) === 'P2002') {
          throw this.rpc('CONFLICT', 'Email customer tersebut sudah digunakan.');
        }
        throw error;
      }
    });
  }

  updateCustomer(payload: AuthenticatedCommand<CustomerInput & { id?: string }>) {
    return this.execute('customer.update', payload, async (input, user) => {
      if (user.role !== 'ADMIN')
        throw this.rpc('FORBIDDEN', 'Hanya admin yang dapat mengelola profil customer.');
      const id = requiredUuid(input?.id, 'ID customer');
      const data = {
        ...(input.name !== undefined ? { name: requiredText(input.name, 'Nama customer') } : {}),
        ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
        ...(input.userId !== undefined ? { userId: input.userId || null } : {}),
        ...(input.phone !== undefined
          ? { phone: optionalText(input.phone, 'Nomor telepon', 40) }
          : {}),
        ...(input.gender !== undefined
          ? { gender: optionalText(input.gender, 'Jenis kelamin', 40) }
          : {}),
        ...(input.birthDate !== undefined
          ? { birthDate: optionalDate(input.birthDate, 'Tanggal lahir') }
          : {}),
        ...(input.address !== undefined
          ? { address: optionalText(input.address, 'Alamat', 300) }
          : {}),
        ...(input.treatment !== undefined
          ? { treatment: optionalText(input.treatment, 'Jenis perawatan', 120) }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.nextVisit !== undefined
          ? { nextVisit: optionalDate(input.nextVisit, 'Jadwal kunjungan') }
          : {}),
        ...(input.note !== undefined ? { note: optionalText(input.note, 'Catatan', 2000) } : {}),
      };
      if (Object.keys(data).length === 0) {
        throw this.rpc('BAD_USER_INPUT', 'Isi nama atau email yang ingin diubah.');
      }
      try {
        return await this.prisma.customer.update({ where: { id }, data });
      } catch (error) {
        if (prismaErrorCode(error) === 'P2002') {
          throw this.rpc('CONFLICT', 'Email customer tersebut sudah digunakan.');
        }
        throwPrismaNotFound(error, 'Customer tidak ditemukan.');
        throw error;
      }
    });
  }

  customers(payload: AuthenticatedCommand<PageInput>) {
    return this.execute('customer.list', payload, async (input, user) => {
      if (user.role !== 'ADMIN')
        throw this.rpc('FORBIDDEN', 'Daftar customer hanya dapat diakses admin.');
      const { page, limit, skip } = getPagination(input);
      const [items, total] = await Promise.all([
        this.prisma.customer.findMany({
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.customer.count(),
      ]);
      return createPage(items, page, limit, total);
    });
  }

  customer(payload: AuthenticatedCommand<{ id?: string }>) {
    return this.execute('customer.get', payload, async (input, user) => {
      const id = requiredUuid(input?.id, 'ID customer');
      const result = await this.prisma.customer.findUnique({ where: { id } });
      if (!result) throw this.rpc('NOT_FOUND', 'Customer tidak ditemukan.');
      if (
        user.role !== 'ADMIN' &&
        !(user.role === 'CUSTOMER' && (result.userId === user.id || result.email === user.email))
      ) {
        throw this.rpc('FORBIDDEN', 'Anda tidak memiliki akses ke profil customer ini.');
      }
      return result;
    });
  }

  deleteCustomer(payload: AuthenticatedCommand<{ id?: string }>) {
    return this.execute('customer.delete', payload, async (input, user) => {
      if (user.role !== 'ADMIN')
        throw this.rpc('FORBIDDEN', 'Hanya admin yang dapat mengelola profil customer.');
      const id = requiredUuid(input?.id, 'ID customer');
      const customer = await this.prisma.customer.findUnique({
        where: { id },
        select: { id: true, _count: { select: { schedules: true } } },
      });
      if (!customer) throw this.rpc('NOT_FOUND', 'Customer tidak ditemukan.');
      if (customer._count.schedules > 0) {
        throw this.rpc(
          'CONFLICT',
          'Customer masih memiliki jadwal. Hapus jadwal terkait sebelum menghapus customer.',
        );
      }
      await this.prisma.customer.delete({ where: { id } });
      return true;
    });
  }
}
