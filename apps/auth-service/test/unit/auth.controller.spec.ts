import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthServiceController } from '../../src/auth/auth.controller.js';
import { AuthService } from '../../src/auth/auth.service.js';

describe('AuthServiceController', () => {
  let appController: AuthServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AuthServiceController],
      providers: [
        {
          provide: AuthService,
          useValue: { getHello: () => 'Auth service is healthy' },
        },
      ],
    }).compile();

    appController = app.get<AuthServiceController>(AuthServiceController);
  });

  describe('root', () => {
    it('should return the auth service health message', () => {
      expect(appController.getHello()).toBe('Auth service is healthy');
    });
  });
});
