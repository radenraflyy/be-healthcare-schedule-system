import {
  BadRequestException,
  NotFoundException,
} from '../../../../common/exceptions/index.js';

export function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${label} wajib diisi.`);
  }
  return value.trim();
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException(
      'Email customer wajib diisi dengan format valid.',
    );
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException(
      'Email customer wajib diisi dengan format valid.',
    );
  }
  return email;
}

export function requiredUuid(value: unknown, label: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new BadRequestException(`${label} harus berupa UUID yang valid.`);
  }
  return value;
}

export function parseDate(value: unknown, label: string): Date {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string'
        ? new Date(value)
        : new Date(Number.NaN);
  if (!Number.isFinite(date.getTime())) {
    throw new BadRequestException(`${label} harus berupa tanggal yang valid.`);
  }
  return date;
}

export function prismaErrorCode(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return undefined;
}

export function throwPrismaNotFound(error: unknown, message: string): void {
  if (prismaErrorCode(error) === 'P2025') {
    throw new NotFoundException(message);
  }
}
