import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { DoctorsService } from '../../src/doctors/doctors.service.js';

function createService(role: 'ADMIN' | 'DOCTOR' | 'CUSTOMER' = 'DOCTOR') {
  const user = {
    id: 'doctor-user-id',
    email: 'doctor@example.test',
    name: 'Doctor Example',
    role,
  };
  const profile = {
    id: 'doctor-profile-id',
    userId: user.id,
    name: 'Doctor Example',
  };
  const prisma = {
    doctor: {
      findUnique: vi.fn().mockResolvedValue(profile),
      findMany: vi.fn().mockResolvedValue([{ userId: user.id, name: profile.name }]),
    },
  };
  const tracer = {
    counter: () => ({ increment: vi.fn() }),
    summary: () => ({ observe: vi.fn() }),
    createSpan: (
      _name: string,
      callback: (span: { setTag: (...args: unknown[]) => void }) => unknown,
    ) => callback({ setTag: vi.fn() }),
  };
  const authService = { send: vi.fn(() => of(user)) };
  const cache = {
    getOrSet: vi.fn(
      async (_namespace: string, _key: unknown, _ttl: number, load: () => Promise<unknown>) =>
        load(),
    ),
    invalidate: vi.fn().mockResolvedValue(undefined),
  };
  return {
    service: new DoctorsService(
      prisma as never,
      tracer as never,
      authService as never,
      cache as never,
    ),
    prisma,
    profile,
  };
}

describe('DoctorsService.myDoctor', () => {
  it('returns only the doctor profile linked to the authenticated account', async () => {
    const context = createService();

    await expect(context.service.myDoctor({ token: 'jwt', input: {} })).resolves.toMatchObject({
      data: context.profile,
    });
    expect(context.prisma.doctor.findUnique).toHaveBeenCalledWith({
      where: { userId: 'doctor-user-id' },
    });

    describe('DoctorsService.doctorAccountLinks', () => {
      it('returns linked account IDs and doctor names for admins', async () => {
        const context = createService('ADMIN');

        await expect(
          context.service.doctorAccountLinks({ token: 'jwt', input: {} }),
        ).resolves.toMatchObject({
          data: [{ userId: 'doctor-user-id', name: 'Doctor Example' }],
        });
        expect(context.prisma.doctor.findMany).toHaveBeenCalledWith({
          where: { userId: { not: null } },
          orderBy: { name: 'asc' },
          select: { userId: true, name: true },
        });
      });

      it('rejects non-admin accounts', async () => {
        const context = createService('DOCTOR');

        await expect(
          context.service.doctorAccountLinks({ token: 'jwt', input: {} }),
        ).rejects.toMatchObject({
          message: 'Hanya admin yang dapat melihat tautan akun dokter.',
        });
        expect(context.prisma.doctor.findMany).not.toHaveBeenCalled();
      });
    });
  });

  it('rejects accounts without the doctor role', async () => {
    const context = createService('CUSTOMER');

    await expect(context.service.myDoctor({ token: 'jwt', input: {} })).rejects.toMatchObject({
      message: 'Fitur ini hanya tersedia untuk akun dokter.',
    });
    expect(context.prisma.doctor.findUnique).not.toHaveBeenCalled();
  });

  it('reports when the authenticated doctor has no linked profile', async () => {
    const context = createService();
    context.prisma.doctor.findUnique.mockResolvedValue(null);

    await expect(context.service.myDoctor({ token: 'jwt', input: {} })).rejects.toMatchObject({
      message: 'Profil dokter belum terhubung ke akun ini. Hubungi admin untuk menautkannya.',
    });
  });
});
