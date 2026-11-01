import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  RpcServiceException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '../../../common/exceptions/index.js';
import { findRpcErrorDetails } from '../../../common/utils/rpc-error.utils.js';
import { TracerService } from '@nestjs/observe';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AuthenticatedCommand,
  AuthenticatedResult,
} from '../../../common/types/authenticated-command.js';

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
  'doctor.get',
  'doctor.delete',
  'schedule.create',
  'schedule.list',
  'schedule.get',
  'schedule.delete',
] as const;
type ServiceOperation = (typeof SERVICE_OPERATIONS)[number];
interface AuthUser {
  id: string;
}

@Injectable()
export class ScheduleOperationService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly tracer: TracerService,
    @Inject(AUTH_SERVICE) protected readonly authService: ClientProxy,
  ) {}

  protected async execute<TInput, TResult>(
    operation: ServiceOperation,
    payload: AuthenticatedCommand<TInput>,
    action: (input: TInput) => Promise<TResult>,
  ): Promise<AuthenticatedResult<TResult>> {
    return this.observeOperation(operation, async () => {
      const user = await this.authenticate(payload?.token);
      if (!payload || payload.input === undefined || payload.input === null) {
        throw this.rpc('BAD_USER_INPUT', 'Data permintaan wajib diisi.');
      }
      const data = await action(payload.input);
      return { data, userId: user.id };
    });
  }

  protected async authenticate(token: unknown): Promise<AuthUser> {
    if (typeof token !== 'string' || token.trim().length === 0) {
      throw this.rpc('UNAUTHENTICATED', 'Token akses wajib disertakan.');
    }
    try {
      return await firstValueFrom(
        this.authService.send<AuthUser, { token: string }>(
          { cmd: 'auth.validateToken' },
          { token },
        ),
      );
    } catch (error) {
      const details = findRpcErrorDetails(error);
      if (details.code === 'UNAUTHENTICATED') {
        throw this.rpc(
          'UNAUTHENTICATED',
          details.message ||
            'Token tidak valid atau sudah kedaluwarsa. Silakan login lagi.',
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
      description:
        'Schedule service operations grouped by operation and outcome',
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
      case 'SERVICE_UNAVAILABLE':
        return new ServiceUnavailableException(message);
      default:
        return new RpcServiceException(code, message);
    }
  }
}
