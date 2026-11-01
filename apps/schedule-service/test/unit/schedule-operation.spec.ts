import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ScheduleOperationService } from '../../src/common/schedule-operation.service.js';

class TestScheduleOperationService extends ScheduleOperationService {
  run(
    operation: string,
    payload: { token: string; input: unknown },
    action = vi.fn(async (input: unknown) => input),
  ) {
    return this.execute(operation as never, payload as never, action as never);
  }
}

function createService(
  authResponse: unknown = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    role: 'CUSTOMER',
  },
) {
  const span = { setTag: vi.fn() };
  const tracer = {
    counter: () => ({ increment: vi.fn() }),
    summary: () => ({ observe: vi.fn() }),
    createSpan: (
      _name: string,
      callback: (span: { setTag: (...args: unknown[]) => void }) => unknown,
    ) => callback(span),
  };
  const cache = {
    getOrSet: vi.fn(
      async (_namespace: string, _key: unknown, _ttl: number, load: () => Promise<unknown>) =>
        load(),
    ),
    invalidate: vi.fn().mockResolvedValue(undefined),
  };
  const authService = {
    send: vi.fn(() => (typeof authResponse === 'function' ? authResponse() : of(authResponse))),
  };
  const service = new TestScheduleOperationService(
    {} as never,
    tracer as never,
    authService as never,
    cache as never,
  );
  return { service, cache, authService, span };
}

describe('ScheduleOperationService', () => {
  it('validates every command, observes it, and caches read operations by user', async () => {
    const { service, cache, authService, span } = createService();
    const action = vi.fn(async (input: unknown) => ({ input }));
    await expect(
      service.run('schedule.list', { token: 'jwt', input: { page: 1 } }, action),
    ).resolves.toEqual({ data: { input: { page: 1 } }, userId: 'user-1' });
    expect(authService.send).toHaveBeenCalledWith({ cmd: 'auth.validateToken' }, { token: 'jwt' });
    expect(cache.getOrSet).toHaveBeenCalledWith(
      'schedule.list',
      { input: { page: 1 }, userId: 'user-1', role: 'CUSTOMER' },
      30,
      expect.any(Function),
    );
    expect(span.setTag).toHaveBeenCalledWith('outcome', 'success');
  });

  it('invalidates cached query namespaces after writes', async () => {
    const { service, cache } = createService();
    await service.run('schedule.create', { token: 'jwt', input: { id: 's1' } });
    expect(cache.invalidate).toHaveBeenCalledWith(
      'schedule.list',
      'schedule.get',
      'availability.list',
      'notification.list',
    );
  });

  it('rejects missing tokens and preserves invalid-token errors from auth service', async () => {
    const missingToken = createService();
    await expect(
      missingToken.service.run('schedule.list', { token: '', input: {} }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const rejectedAuth = createService(() =>
      throwError(() => ({
        error: { code: 'UNAUTHENTICATED', message: 'Token tidak valid.' },
      })),
    );
    await expect(
      rejectedAuth.service.run('schedule.list', { token: 'bad', input: {} }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('turns auth service outages into a friendly unavailable error and records failed spans', async () => {
    const { service, span } = createService(() => throwError(() => new Error('ECONNREFUSED')));
    await expect(service.run('schedule.list', { token: 'jwt', input: {} })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(span.setTag).toHaveBeenCalledWith('outcome', 'error');
  });
});
