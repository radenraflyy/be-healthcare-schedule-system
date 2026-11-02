import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { TracerService } from '@nestjs/observe';
import { firstValueFrom, timeout } from 'rxjs';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  RpcServiceException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '../../../common/exceptions/index.js';
import type {
  AuthenticatedCommand,
  AuthenticatedResult,
} from '../../../common/types/authenticated-command.js';
import { findRpcErrorDetails } from '../../../common/utils/rpc-error.utils.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisCacheService } from './redis-cache.service.js';

const AUTH_SERVICE = 'AUTH_SERVICE';
const SERVICE_OPERATIONS = [
  'health_check',
  'customer.create',
  'customer.update',
  'customer.list',
  'customer.get',
  'customer.delete',
  'doctor.create',
  'doctor.update',
  'doctor.list',
  'doctor.unlinked',
  'doctor.links',
  'doctor.get',
  'doctor.me',
  'doctor.delete',
  'schedule.create',
  'schedule.list',
  'schedule.get',
  'schedule.delete',
  'schedule.update_status',
  'schedule.reschedule',
  'availability.set',
  'availability.delete',
  'availability.list',
  'availability.windows',
  'notification.list',
  'notification.read',
  'workflow.get',
  'workflow.save',
] as const;
type ServiceOperation = (typeof SERVICE_OPERATIONS)[number];
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'DOCTOR' | 'CUSTOMER';
}

@Injectable()
export class ScheduleOperationService {
  private readonly cacheableOperations = new Set<ServiceOperation>([
    'customer.list',
    'customer.get',
    'doctor.list',
    'doctor.unlinked',
    'doctor.links',
    'doctor.get',
    'doctor.me',
    'schedule.list',
    'schedule.get',
    'availability.list',
    'availability.windows',
    'notification.list',
    'workflow.get',
  ]);

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly tracer: TracerService,
    @Inject(AUTH_SERVICE) protected readonly authService: ClientProxy,
    protected readonly cache: RedisCacheService,
  ) {}

  protected async execute<TInput, TResult>(
    operation: ServiceOperation,
    payload: AuthenticatedCommand<TInput>,
    action: (input: TInput, user: AuthUser) => Promise<TResult>,
  ): Promise<AuthenticatedResult<TResult>> {
    return this.observeOperation(operation, async () => {
      const user = await this.authenticate(payload?.token);
      if (!payload || payload.input === undefined || payload.input === null) {
        throw this.rpc('BAD_USER_INPUT', 'Data permintaan wajib diisi.');
      }
      const data = this.cacheableOperations.has(operation)
        ? await this.cache.getOrSet(
            operation,
            { input: payload.input, userId: user.id, role: user.role },
            Number(process.env.QUERY_CACHE_TTL_SECONDS ?? 30),
            () => action(payload.input, user),
          )
        : await action(payload.input, user);
      if (!this.cacheableOperations.has(operation)) {
        await this.cache.invalidate(...this.cacheInvalidationNamespaces(operation));
      }
      return { data, userId: user.id };
    });
  }

  protected async authenticate(token: unknown): Promise<AuthUser> {
    if (typeof token !== 'string' || token.trim().length === 0) {
      throw this.rpc('UNAUTHENTICATED', 'Token akses wajib disertakan.');
    }
    try {
      return await firstValueFrom(
        this.authService
          .send<AuthUser, { token: string }>({ cmd: 'auth.validateToken' }, { token })
          .pipe(timeout({ first: 5_000 })),
      );
    } catch (error) {
      const details = findRpcErrorDetails(error);
      if (details.code === 'UNAUTHENTICATED') {
        throw this.rpc(
          'UNAUTHENTICATED',
          details.message || 'Token tidak valid atau sudah kedaluwarsa. Silakan login lagi.',
        );
      }
      throw this.rpc(
        'SERVICE_UNAVAILABLE',
        'Layanan autentikasi sedang tidak tersedia. Coba lagi sebentar.',
      );
    }
  }

  protected async observeOperation<T>(
    operation: ServiceOperation,
    run: () => Promise<T>,
  ): Promise<T> {
    const outcomes = this.tracer.counter('schedule_operations_total', {
      description: 'Schedule service operations grouped by operation and outcome',
      labels: ['operation', 'outcome'],
    });
    const duration = this.tracer.summary('schedule_operation_duration_ms', {
      description: 'Schedule service operation duration in milliseconds',
      labels: [...SERVICE_OPERATIONS],
      sampleSize: 256,
    });
    const startedAt = performance.now();

    return this.tracer.createSpan(`schedule.${operation}`, async (span) => {
      span.setTag('operation', operation);
      try {
        const result = await run();
        span.setTag('outcome', 'success');
        outcomes.increment({ operation, outcome: 'success' });
        return result;
      } catch (error) {
        span.setTag('outcome', 'error');
        outcomes.increment({ operation, outcome: 'error' });
        throw error;
      } finally {
        duration.observe(performance.now() - startedAt, operation);
      }
    });
  }

  protected rpc(code: string, message: string) {
    switch (code) {
      case 'BAD_USER_INPUT':
        return new BadRequestException(message);
      case 'UNAUTHENTICATED':
        return new UnauthorizedException(message);
      case 'NOT_FOUND':
        return new NotFoundException(message);
      case 'CONFLICT':
        return new ConflictException(message);
      case 'FORBIDDEN':
        return new ForbiddenException(message);
      case 'SERVICE_UNAVAILABLE':
        return new ServiceUnavailableException(message);
      default:
        return new RpcServiceException(code, message);
    }
  }

  private cacheInvalidationNamespaces(operation: ServiceOperation): string[] {
    if (operation.startsWith('customer.')) {
      return ['customer.list', 'customer.get', 'schedule.list', 'schedule.get'];
    }
    if (operation.startsWith('doctor.') || operation.startsWith('availability.')) {
      return [
        'doctor.list',
        'doctor.unlinked',
        'doctor.links',
        'doctor.get',
        'doctor.me',
        'availability.list',
        'availability.windows',
        'schedule.list',
        'schedule.get',
      ];
    }
    if (operation.startsWith('schedule.')) {
      return ['schedule.list', 'schedule.get', 'availability.list', 'notification.list'];
    }
    if (operation.startsWith('notification.')) return ['notification.list'];
    if (operation.startsWith('workflow.')) return ['workflow.get'];
    return [];
  }
}
