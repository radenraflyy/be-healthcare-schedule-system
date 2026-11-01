import { describe, expect, it } from 'vitest';

import { createPage, getPagination } from '../../src/common/utils/pagination.utils.js';
import {
  normalizeEmail,
  parseDate,
  prismaErrorCode,
  requiredText,
  requiredUuid,
  throwPrismaNotFound,
} from '../../src/common/utils/validation.utils.js';

describe('schedule pagination utils', () => {
  it('applies defaults and computes page offsets', () => {
    expect(getPagination()).toEqual({ page: 1, limit: 20, skip: 0 });
    expect(getPagination({ page: 3, limit: 10 })).toEqual({
      page: 3,
      limit: 10,
      skip: 20,
    });
    expect(createPage(['a'], 1, 1, 4)).toEqual({
      items: ['a'],
      page: 1,
      limit: 1,
      total: 4,
      totalPages: 4,
    });
  });

  it('rejects invalid page and limit values', () => {
    expect(() => getPagination({ page: 0 })).toThrow();
    expect(() => getPagination({ limit: 101 })).toThrow();
  });
});

describe('schedule validation utils', () => {
  it('normalizes text and email inputs', () => {
    expect(requiredText('  Amani  ', 'Nama')).toBe('Amani');
    expect(normalizeEmail('A@Example.com')).toBe('a@example.com');
    expect(() => requiredText(' ', 'Nama')).toThrow();
    expect(() => normalizeEmail('bad')).toThrow();
  });

  it('validates UUIDs and dates', () => {
    expect(requiredUuid('123e4567-e89b-42d3-a456-426614174000', 'ID')).toBe(
      '123e4567-e89b-42d3-a456-426614174000',
    );
    expect(parseDate('2026-11-02T09:00:00.000Z', 'Waktu').toISOString()).toBe(
      '2026-11-02T09:00:00.000Z',
    );
    expect(() => requiredUuid('bad', 'ID')).toThrow();
    expect(() => parseDate({}, 'Waktu')).toThrow();
  });

  it('recognizes Prisma errors and translates missing records', () => {
    expect(prismaErrorCode({ code: 'P2002' })).toBe('P2002');
    expect(prismaErrorCode(new Error('x'))).toBeUndefined();
    expect(() => throwPrismaNotFound({ code: 'P2025' }, 'Tidak ditemukan.')).toThrow();
    expect(() => throwPrismaNotFound({ code: 'P2002' }, 'Tidak ditemukan.')).not.toThrow();
  });
});
