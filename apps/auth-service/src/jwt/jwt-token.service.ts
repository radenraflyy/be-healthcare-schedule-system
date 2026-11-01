import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { UnauthorizedException } from '../../../common/exceptions/index.js';
import { createHmac, timingSafeEqual } from 'node:crypto';

interface AccessTokenClaims {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtTokenService {
  readonly expiresInSeconds = 15 * 60;
  private readonly secret: Buffer;

  constructor(config: ConfigService) {
    const secret = config.getOrThrow<string>('JWT_SECRET');
    if (Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error('JWT_SECRET must be at least 32 bytes');
    }
    this.secret = Buffer.from(secret, 'utf8');
  }

  createAccessToken(user: { id: string; email: string }): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const payload = this.encode({
      sub: user.id,
      email: user.email,
      iat: issuedAt,
      exp: issuedAt + this.expiresInSeconds,
    } satisfies AccessTokenClaims);
    const content = `${header}.${payload}`;
    return `${content}.${this.sign(content).toString('base64url')}`;
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
      throw this.invalidTokenError();
    }

    try {
      const header = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf8'),
      ) as { alg?: string; typ?: string };
      if (header.alg !== 'HS256' || header.typ !== 'JWT') {
        throw this.invalidTokenError();
      }

      const expectedSignature = this.sign(`${parts[0]}.${parts[1]}`);
      const receivedSignature = Buffer.from(parts[2], 'base64url');
      if (
        receivedSignature.length !== expectedSignature.length ||
        !timingSafeEqual(receivedSignature, expectedSignature)
      ) {
        throw this.invalidTokenError();
      }

      const claims = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as Partial<AccessTokenClaims>;
      const now = Math.floor(Date.now() / 1000);
      if (
        typeof claims.sub !== 'string' ||
        claims.sub.length === 0 ||
        typeof claims.email !== 'string' ||
        typeof claims.exp !== 'number' ||
        typeof claims.iat !== 'number' ||
        now >= claims.exp
      ) {
        throw this.invalidTokenError();
      }

      return claims as AccessTokenClaims;
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }
      throw this.invalidTokenError();
    }
  }

  private encode(value: object): string {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  }

  private sign(content: string): Buffer {
    return createHmac('sha256', this.secret).update(content).digest();
  }

  private invalidTokenError(): RpcException {
    return new UnauthorizedException(
      'Token tidak valid atau sudah kedaluwarsa. Silakan login lagi.',
    );
  }
}
