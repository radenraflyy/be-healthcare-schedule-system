import { Module } from '@nestjs/common';
import { ScheduleServiceController } from './schedule-service.controller.js';
import { ScheduleService } from './schedule-service.service.js';

@Module({
  imports: [],
  controllers: [ScheduleServiceController],
  providers: [ScheduleService],
})
export class ScheduleServiceModule {}
