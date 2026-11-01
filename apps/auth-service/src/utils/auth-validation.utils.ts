import {
  BadRequestException,
  UnauthorizedException,
} from '../../../common/exceptions/index.js';

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(
      'Email wajib diisi dengan format yang valid.',
    );
  }

  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException(
      'Email wajib diisi dengan format yang valid.',
    );
  }
  return email;
}

export function validatePassword(
  value: unknown,
  options: { forLogin?: boolean } = {},
): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BadRequestException('Password wajib diisi.');
  }
  if (Buffer.byteLength(value, 'utf8') > 72) {
    throw new BadRequestException(
      'Password terlalu panjang. Maksimal 72 byte.',
    );
  }
  if (!options.forLogin && value.length < 8) {
    throw new BadRequestException('Password minimal terdiri dari 8 karakter.');
  }
  return value;
}

export function extractToken(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new UnauthorizedException('Token akses wajib disertakan.');
  }
  const token = value.trim();
  return token.startsWith('Bearer ') ? token.slice(7).trim() : token;
}
