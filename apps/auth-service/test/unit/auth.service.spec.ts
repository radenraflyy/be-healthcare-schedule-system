import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../src/auth/auth.service.js';
import { hashPassword } from '../../src/helpers/password.helper.js';

function createService(overrides: Record<string, unknown> = {}) {
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    password: '$2a$12$hash',
    name: 'User',
    role: 'CUSTOMER',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const prisma = {
    user: {
      create: vi.fn().mockResolvedValue(user),
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue(user),
    },
  };
  const jwt = {
    createAccessToken: vi.fn().mockReturnValue('jwt-token'),
    verifyAccessToken: vi.fn().mockReturnValue({ sub: 'user-1', email: user.email }),
    expiresInSeconds: 900,
  };
  const tracer = {
    counter: () => ({ increment: vi.fn() }),
    summary: () => ({ observe: vi.fn() }),
    createSpan: (
      _name: string,
      callback: (span: { setTag: (key: string, value: string) => void }) => unknown,
    ) => callback({ setTag: vi.fn() }),
  };
  const rateLimiter = { consume: vi.fn().mockResolvedValue(undefined) };
  const service = new AuthService(
    prisma as never,
    jwt as never,
    tracer as never,
    rateLimiter as never,
  );
  return { service, prisma, jwt, rateLimiter, user, ...overrides };
}

describe('AuthService', () => {
  it('registers users with a bcrypt hash and rate limits by normalized email', async () => {
    const context = createService();
    const result = await context.service.register({
      email: ' User@Example.com ',
      password: 'StrongPass123',
      name: ' Amani ',
    });
    expect(context.rateLimiter.consume).toHaveBeenCalledWith('register', 'user@example.com');
    const createArgs = context.prisma.user.create.mock.calls[0][0] as {
      data: { email: string; name: string; password: string };
      select: Record<string, boolean>;
    };
    expect(createArgs.data).toMatchObject({
      email: 'user@example.com',
      name: 'Amani',
    });
    expect(createArgs.data.password).toMatch(/^\$2/);
    expect(createArgs.select).not.toHaveProperty('password');
    expect(result.email).toBe('user@example.com');
  });

  it('reports duplicate emails as a conflict', async () => {
    const context = createService();
    context.prisma.user.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      context.service.register({
        email: 'user@example.com',
        password: 'StrongPass123',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('returns an access token for valid credentials and rejects invalid credentials', async () => {
    const context = createService();
    context.prisma.user.findUnique.mockResolvedValue({
      ...context.user,
      password: await hashPassword('StrongPass123'),
    });
    await expect(
      context.service.login({
        email: context.user.email,
        password: 'StrongPass123',
      }),
    ).resolves.toMatchObject({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 'user-1', role: 'CUSTOMER' },
    });
    expect(context.rateLimiter.consume).toHaveBeenCalledWith('login', context.user.email);
    await expect(
      context.service.login({
        email: context.user.email,
        password: 'WrongPass123',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('validates access tokens and returns only public user data', async () => {
    const context = createService();
    await expect(
      context.service.validateToken({ token: 'Bearer jwt-token' }),
    ).resolves.toMatchObject({
      id: 'user-1',
      email: context.user.email,
      role: 'CUSTOMER',
    });
    context.prisma.user.findUnique.mockResolvedValue(null);
    await expect(context.service.validateToken({ token: 'jwt-token' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('allows admins to change another user role only', async () => {
    const context = createService();
    context.prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    await expect(
      context.service.setUserRole({
        token: 'jwt-token',
        userId: 'user-2',
        role: 'DOCTOR',
      }),
    ).resolves.toMatchObject({ role: 'CUSTOMER' });
    await expect(
      context.service.setUserRole({
        token: 'jwt-token',
        userId: 'user-1',
        role: 'DOCTOR',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    context.prisma.user.findUnique.mockResolvedValue({ role: 'CUSTOMER' });
    await expect(
      context.service.setUserRole({
        token: 'jwt-token',
        userId: 'user-2',
        role: 'DOCTOR',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
