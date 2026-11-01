import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'apps/common/exceptions/**/*.ts',
        'apps/common/redis/**/*.ts',
        'apps/common/utils/**/*.ts',
        'apps/auth-service/src/auth/auth.service.ts',
        'apps/auth-service/src/auth/rate-limit.service.ts',
        'apps/auth-service/src/helpers/**/*.ts',
        'apps/auth-service/src/utils/**/*.ts',
        'apps/schedule-service/src/common/schedule-operation.service.ts',
        'apps/schedule-service/src/common/redis-cache.service.ts',
        'apps/schedule-service/src/common/schedule-email-queue.service.ts',
        'apps/schedule-service/src/common/utils/**/*.ts',
        'apps/schedule-service/src/schedules/schedules.service.ts',
        'apps/notification-service/src/email/email.service.ts',
        'apps/notification-service/src/email/email.processor.ts',
      ],
      exclude: ['**/*.spec.ts', '**/index.ts'],
      thresholds: {
        lines: 50,
        statements: 50,
        functions: 50,
        branches: 50,
      },
    },
  },
});
