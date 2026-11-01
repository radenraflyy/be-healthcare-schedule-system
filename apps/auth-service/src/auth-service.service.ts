import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { hash, compare } from 'bcryptjs';
import { TracerService } from '@nestjs/observe';
import { PrismaService } from './prisma/prisma.service.js';
import { JwtTokenService } from './jwt-token.service.js';

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenInput {
  token: string;
}

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
      const email = this.normalizeEmail(input?.email);
      const password = this.validatePassword(input?.password);
      const name =
        typeof input.name === 'string' ? input.name.trim() || null : null;
      const passwordHash = await hash(password, 12);

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
          throw new RpcException({
            code: 'CONFLICT',
            message: 'Email tersebut sudah terdaftar. Gunakan email lain.',
          });
        }
        throw error;
      }
    });
  }

  async login(input: LoginInput) {
    return this.observeOperation('login', async () => {
      const email = this.normalizeEmail(input?.email);
      const password = this.validatePassword(input?.password, {
        forLogin: true,
      });
      const user = await this.prisma.user.findUnique({ where: { email } });

      if (!user || !(await compare(password, user.password))) {
        throw new RpcException({
          code: 'UNAUTHENTICATED',
          message: 'Email atau password salah. Periksa kembali lalu coba lagi.',
        });
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
      const token = this.extractToken(input?.token);
      const claims = this.jwtTokenService.verifyAccessToken(token);
      const user = await this.prisma.user.findUnique({
        where: { id: claims.sub },
        select: publicUserSelect,
      });

      if (!user) {
        throw new RpcException({
          code: 'UNAUTHENTICATED',
          message:
            'Token tidak valid atau sudah kedaluwarsa. Silakan login lagi.',
        });
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

  private normalizeEmail(value: unknown): string {
    if (typeof value !== 'string') {
      throw new RpcException({
        code: 'BAD_USER_INPUT',
        message: 'Email wajib diisi dengan format yang valid.',
      });
    }

    const email = value.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new RpcException({
        code: 'BAD_USER_INPUT',
        message: 'Email wajib diisi dengan format yang valid.',
      });
    }
    return email;
  }

  private validatePassword(
    value: unknown,
    options: { forLogin?: boolean } = {},
  ): string {
    if (typeof value !== 'string') {
      throw new RpcException({
        code: 'BAD_USER_INPUT',
        message: 'Password wajib diisi.',
      });
    }

    const byteLength = Buffer.byteLength(value, 'utf8');
    if (byteLength > 72) {
      throw new RpcException({
        code: 'BAD_USER_INPUT',
        message: 'Password terlalu panjang. Maksimal 72 byte.',
      });
    }
    if (!options.forLogin && value.length < 8) {
      throw new RpcException({
        code: 'BAD_USER_INPUT',
        message: 'Password minimal terdiri dari 8 karakter.',
      });
    }
    if (value.length === 0) {
      throw new RpcException({
        code: 'BAD_USER_INPUT',
        message: 'Password wajib diisi.',
      });
    }
    return value;
  }

  private extractToken(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new RpcException({
        code: 'UNAUTHENTICATED',
        message: 'Token akses wajib disertakan.',
      });
    }
    const token = value.trim();
    return token.startsWith('Bearer ') ? token.slice(7).trim() : token;
  }
}
