import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthServiceController } from './auth-service.controller.js';
import { AuthService } from './auth-service.service.js';

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
