import { Injectable } from '@nestjs/common';
import { TracerService } from '@nestjs/observe';

import {
  ConflictException,
  ForbiddenException,
  InvalidCredentialsException,
  UnauthorizedException,
} from '../../../common/exceptions/index.js';
import { hashPassword, verifyPassword } from '../helpers/password.helper.js';
import { JwtTokenService } from '../jwt/jwt-token.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { extractToken, normalizeEmail, validatePassword } from '../utils/auth-validation.utils.js';
import type {
  CreateManagedUserInput,
  LoginInput,
  RegisterInput,
  SetUserRoleInput,
  TokenInput,
  UserRole,
} from './dto/auth.inputs.js';
import { AuthRateLimitService } from './rate-limit.service.js';
import { TokenRevocationService } from './token-revocation.service.js';

export type {
  LoginInput,
  RegisterInput,
  CreateManagedUserInput,
  TokenInput,
  SetUserRoleInput,
  UserRole,
} from './dto/auth.inputs.js';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
  role: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly tracer: TracerService,
    private readonly rateLimiter: AuthRateLimitService,
    private readonly tokenRevocations: TokenRevocationService,
  ) {}

  getHello(): string {
    return 'Auth service is healthy';
  }

  async register(input: RegisterInput) {
    return this.observeOperation('register', async () => {
      const email = normalizeEmail(input?.email);
      await this.rateLimiter.consume('register', email);
      const password = validatePassword(input?.password);
      const name = typeof input.name === 'string' ? input.name.trim() || null : null;
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
          throw new ConflictException('Email tersebut sudah terdaftar. Gunakan email lain.');
        }
        throw error;
      }
    });
  }

  async login(input: LoginInput) {
    return this.observeOperation('login', async () => {
      const email = normalizeEmail(input?.email);
      await this.rateLimiter.consume('login', email);
      const password = validatePassword(input?.password, {
        forLogin: true,
      });
      const user = await this.prisma.user.findUnique({ where: { email } });

      if (!user || !(await verifyPassword(password, user.password))) {
        throw new InvalidCredentialsException(
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
          role: user.role,
        },
      };
    });
  }

  async validateToken(input: TokenInput) {
    return this.observeOperation('validate_token', async () => {
      const token = extractToken(input?.token);
      const claims = this.jwtTokenService.verifyAccessToken(token);
      await this.tokenRevocations.assertNotRevoked(token);
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

  async logout(input: TokenInput): Promise<boolean> {
    return this.observeOperation('logout', async () => {
      const token = extractToken(input?.token);
      const claims = this.jwtTokenService.verifyAccessToken(token);
      await this.tokenRevocations.revoke(token, claims.exp);
      return true;
    });
  }

  async setUserRole(input: SetUserRoleInput) {
    const token = extractToken(input?.token);
    const claims = this.jwtTokenService.verifyAccessToken(token);
    await this.tokenRevocations.assertNotRevoked(token);
    const actor = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: { role: true },
    });
    if (actor?.role !== 'ADMIN') {
      throw new ForbiddenException('Hanya admin yang dapat mengubah role.');
    }
    if (input.userId === claims.sub) {
      throw new ForbiddenException('Admin tidak dapat mengubah role akunnya sendiri.');
    }
    if (!['ADMIN', 'DOCTOR', 'CUSTOMER'].includes(input.role)) {
      throw new ForbiddenException('Role yang diminta tidak valid.');
    }
    return this.prisma.user.update({
      where: { id: input.userId },
      data: { role: input.role as UserRole },
      select: publicUserSelect,
    });
  }

  async adminUsers(input: TokenInput) {
    const token = extractToken(input?.token);
    const claims = this.jwtTokenService.verifyAccessToken(token);
    await this.tokenRevocations.assertNotRevoked(token);
    const actor = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: { role: true },
    });
    if (actor?.role !== 'ADMIN') {
      throw new ForbiddenException('Hanya admin yang dapat melihat daftar pengguna.');
    }
    return this.prisma.user.findMany({
      select: publicUserSelect,
      orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
    });
  }

  async createManagedUser(input: CreateManagedUserInput) {
    const token = extractToken(input?.token);
    const claims = this.jwtTokenService.verifyAccessToken(token);
    await this.tokenRevocations.assertNotRevoked(token);
    const actor = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: { role: true },
    });
    if (actor?.role !== 'ADMIN') {
      throw new ForbiddenException('Hanya admin yang dapat membuat akun.');
    }

    const email = normalizeEmail(input?.email);
    const password = validatePassword(input?.password);
    const name = typeof input.name === 'string' ? input.name.trim() || null : null;
    if (!['ADMIN', 'DOCTOR', 'CUSTOMER'].includes(input.role)) {
      throw new ForbiddenException('Role yang diminta tidak valid.');
    }

    try {
      return await this.prisma.user.create({
        data: {
          email,
          password: await hashPassword(password),
          name,
          role: input.role,
        },
        select: publicUserSelect,
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email tersebut sudah terdaftar. Gunakan email lain.');
      }
      throw error;
    }
  }

  private async observeOperation<T>(
    operation: 'register' | 'login' | 'validate_token' | 'logout',
    run: () => Promise<T>,
  ): Promise<T> {
    const outcomes = this.tracer.counter('auth_operations_total', {
      description: 'Authentication operations grouped by operation and outcome',
      labels: ['operation', 'outcome'],
    });
    const duration = this.tracer.summary('auth_operation_duration_ms', {
      description: 'Authentication operation duration in milliseconds',
      labels: ['register', 'login', 'validate_token', 'logout'],
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
