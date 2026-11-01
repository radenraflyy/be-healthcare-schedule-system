import { Controller, Get } from '@nestjs/common';
import { ScheduleServiceService } from './schedule-service.service.js';

@Controller()
export class ScheduleServiceController {
  constructor(private readonly scheduleServiceService: ScheduleServiceService) {}

  @Get()
  getHello(): string {
    return this.scheduleServiceService.getHello();
  }
}
