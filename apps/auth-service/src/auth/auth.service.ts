import { Injectable } from '@nestjs/common';
import { TracerService } from '@nestjs/observe';
import {
  ConflictException,
  UnauthorizedException,
} from '../../../common/exceptions/index.js';
import { hashPassword, verifyPassword } from '../helpers/password.helper.js';
import {
  extractToken,
  normalizeEmail,
  validatePassword,
} from '../utils/auth-validation.utils.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtTokenService } from '../jwt/jwt-token.service.js';
import type {
  LoginInput,
  RegisterInput,
  TokenInput,
} from './dto/auth.inputs.js';

export type {
  LoginInput,
  RegisterInput,
  TokenInput,
} from './dto/auth.inputs.js';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly tracer: TracerService,
  ) {}

  getHello(): string {
    return 'Auth service is healthy';
  }

  async register(input: RegisterInput) {
    return this.observeOperation('register', async () => {
      const email = normalizeEmail(input?.email);
      const password = validatePassword(input?.password);
      const name =
        typeof input.name === 'string' ? input.name.trim() || null : null;
      const passwordHash = await hashPassword(password);

      try {
        return await this.prisma.user.create({
          data: { email, password: passwordHash, name },
          select: publicUserSelect,
        });
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            'Email tersebut sudah terdaftar. Gunakan email lain.',
          );
        }
        throw error;
      }
    });
  }

  async login(input: LoginInput) {
    return this.observeOperation('login', async () => {
      const email = normalizeEmail(input?.email);
      const password = validatePassword(input?.password, {
        forLogin: true,
      });
      const user = await this.prisma.user.findUnique({ where: { email } });

      if (!user || !(await verifyPassword(password, user.password))) {
        throw new UnauthorizedException(
          'Email atau password salah. Periksa kembali lalu coba lagi.',
        );
      }

      return {
        accessToken: this.jwtTokenService.createAccessToken({
          id: user.id,
          email: user.email,
        }),
        tokenType: 'Bearer',
        expiresIn: this.jwtTokenService.expiresInSeconds,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        },
      };
    });
  }

  async validateToken(input: TokenInput) {
    return this.observeOperation('validate_token', async () => {
      const token = extractToken(input?.token);
      const claims = this.jwtTokenService.verifyAccessToken(token);
      const user = await this.prisma.user.findUnique({
        where: { id: claims.sub },
        select: publicUserSelect,
      });

      if (!user) {
        throw new UnauthorizedException(
          'Token tidak valid atau sudah kedaluwarsa. Silakan login lagi.',
        );
      }

      return user;
    });
  }

  private async observeOperation<T>(
    operation: 'register' | 'login' | 'validate_token',
    run: () => Promise<T>,
  ): Promise<T> {
    const outcomes = this.tracer.counter('auth_operations_total', {
      description: 'Authentication operations grouped by operation and outcome',
      labels: ['operation', 'outcome'],
    });
    const duration = this.tracer.summary('auth_operation_duration_ms', {
      description: 'Authentication operation duration in milliseconds',
      labels: ['register', 'login', 'validate_token'],
      sampleSize: 256,
    });
    const startedAt = performance.now();

    return this.tracer.createSpan(`auth.${operation}`, async (span) => {
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
}
