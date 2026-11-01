import { Injectable } from '@nestjs/common';
import { TracerService } from '@nestjs/observe';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScheduleOperationService } from '../common/schedule-operation.service.js';
import { getPagination, createPage } from '../common/utils/pagination.utils.js';
import {
  requiredText,
  normalizeEmail,
  requiredUuid,
  prismaErrorCode,
  throwPrismaNotFound,
} from '../common/utils/validation.utils.js';
import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import type { CustomerInput } from './dto/customer.input.js';
import type { PageInput } from '../common/types/pagination.js';

@Injectable()
export class CustomersService extends ScheduleOperationService {
  constructor(
    prisma: PrismaService,
    tracer: TracerService,
    authService: ClientProxy,
  ) {
    super(prisma, tracer, authService);
  }

  createCustomer(payload: AuthenticatedCommand<CustomerInput>) {
    return this.execute('customer.create', payload, async (input) => {
      const name = requiredText(input?.name, 'Nama customer');
      const email = normalizeEmail(input?.email);
      try {
        return await this.prisma.customer.create({ data: { name, email } });
      } catch (error) {
        if (prismaErrorCode(error) === 'P2002') {
          throw this.rpc(
            'CONFLICT',
            'Email customer tersebut sudah digunakan.',
          );
        }
        throw error;
      }
    });
  }

  updateCustomer(
    payload: AuthenticatedCommand<CustomerInput & { id?: string }>,
  ) {
    return this.execute('customer.update', payload, async (input) => {
      const id = requiredUuid(input?.id, 'ID customer');
      const data: { name?: string; email?: string } = {};
      if (input.name !== undefined)
        data.name = requiredText(input.name, 'Nama customer');
      if (input.email !== undefined) data.email = normalizeEmail(input.email);
      if (Object.keys(data).length === 0) {
        throw this.rpc(
          'BAD_USER_INPUT',
          'Isi nama atau email yang ingin diubah.',
        );
      }
      try {
        return await this.prisma.customer.update({ where: { id }, data });
      } catch (error) {
        if (prismaErrorCode(error) === 'P2002') {
          throw this.rpc(
            'CONFLICT',
            'Email customer tersebut sudah digunakan.',
          );
        }
        throwPrismaNotFound(error, 'Customer tidak ditemukan.');
        throw error;
      }
    });
  }

  customers(payload: AuthenticatedCommand<PageInput>) {
    return this.execute('customer.list', payload, async (input) => {
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
    return this.execute('customer.get', payload, async (input) => {
      const id = requiredUuid(input?.id, 'ID customer');
      const result = await this.prisma.customer.findUnique({ where: { id } });
      if (!result) throw this.rpc('NOT_FOUND', 'Customer tidak ditemukan.');
      return result;
    });
  }

  deleteCustomer(payload: AuthenticatedCommand<{ id?: string }>) {
    return this.execute('customer.delete', payload, async (input) => {
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
