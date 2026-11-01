import { Controller, Get } from '@nestjs/common';
import { ScheduleService } from './schedule-service.service.js';

@Controller()
export class ScheduleServiceController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  getHello(): string {
    return this.scheduleService.getHello();
  }
}
