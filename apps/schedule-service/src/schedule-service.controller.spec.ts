import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ScheduleServiceController } from './schedule-service.controller.js';
import { ScheduleService } from './schedule-service.service.js';

describe('ScheduleServiceController', () => {
  let scheduleServiceController: ScheduleServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ScheduleServiceController],
      providers: [ScheduleService],
    }).compile();

    scheduleServiceController = app.get<ScheduleServiceController>(
      ScheduleServiceController,
    );
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(scheduleServiceController.getHello()).toBe('Hello World!');
    });
  });
});
