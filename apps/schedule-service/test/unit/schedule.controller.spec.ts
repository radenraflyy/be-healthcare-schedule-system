import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { HealthController } from '../../src/health/health.controller.js';
import { ScheduleHealthService } from '../../src/health/health.service.js';

describe('ScheduleServiceController', () => {
  let scheduleServiceController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ScheduleHealthService,
          useValue: {
            check: () => ({
              data: 'Schedule service is healthy',
              userId: 'test',
            }),
          },
        },
      ],
    }).compile();

    scheduleServiceController = app.get<HealthController>(HealthController);
  });

  describe('root', () => {
    it('should return a health response', () => {
      expect(scheduleServiceController.check({ token: 'token', input: {} })).toEqual({
        data: 'Schedule service is healthy',
        userId: 'test',
      });
    });
  });
});
