import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ScheduleService } from './schedule-service.service.js';

@Controller()
export class ScheduleServiceController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @MessagePattern({ cmd: 'schedule.health' })
  getHello(): string {
    return this.scheduleService.getHello();
  }
}
