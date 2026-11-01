import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../../src/helpers/password.helper.js';
import {
  extractToken,
  normalizeEmail,
  validatePassword,
} from '../../src/utils/auth-validation.utils.js';

describe('auth validation utils', () => {
  it('normalizes valid emails and rejects invalid values', () => {
    expect(normalizeEmail('  User@Example.com ')).toBe('user@example.com');
    expect(() => normalizeEmail('no-at-sign')).toThrow();
    expect(() => normalizeEmail(null)).toThrow();
  });

  it('validates registration and login passwords', () => {
    expect(validatePassword('StrongPass123')).toBe('StrongPass123');
    expect(validatePassword('x', { forLogin: true })).toBe('x');
    expect(() => validatePassword('short')).toThrow();
    expect(() => validatePassword('a'.repeat(73), { forLogin: true })).toThrow();
    expect(() => validatePassword('')).toThrow();
  });

  it('extracts a raw token or a bearer token', () => {
    expect(extractToken('Bearer abc.def')).toBe('abc.def');
    expect(extractToken('abc.def')).toBe('abc.def');
    expect(() => extractToken(' ')).toThrow();
  });
});

describe('password helper', () => {
  it('hashes with bcrypt and verifies the original password', async () => {
    const hashed = await hashPassword('StrongPass123');
    expect(hashed).not.toBe('StrongPass123');
    expect(await verifyPassword('StrongPass123', hashed)).toBe(true);
    expect(await verifyPassword('WrongPass123', hashed)).toBe(false);
  });
});
