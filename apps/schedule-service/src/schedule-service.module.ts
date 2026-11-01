import { Module } from '@nestjs/common';
import { ScheduleServiceController } from './schedule-service.controller.js';
import { ScheduleServiceService } from './schedule-service.service.js';

@Module({
  imports: [],
  controllers: [ScheduleServiceController],
  providers: [ScheduleServiceService],
})
export class ScheduleServiceModule {}
