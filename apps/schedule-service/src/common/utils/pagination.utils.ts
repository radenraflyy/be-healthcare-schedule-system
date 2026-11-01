import { BadRequestException } from '../../../../common/exceptions/index.js';
import type { Page, PageInput } from '../types/pagination.js';

export function getPagination(input?: PageInput) {
  const page = input?.page ?? 1;
  const limit = input?.limit ?? 20;
  if (!Number.isInteger(page) || page < 1) {
    throw new BadRequestException('Nomor halaman minimal 1.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new BadRequestException('Limit harus antara 1 sampai 100.');
  }
  return { page, limit, skip: (page - 1) * limit };
}

export function createPage<TResult>(
  items: TResult[],
  page: number,
  limit: number,
  total: number,
): Page<TResult> {
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}
