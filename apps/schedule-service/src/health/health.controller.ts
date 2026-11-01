import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import { ScheduleHealthService } from './health.service.js';

@Controller()
export class HealthController {
  constructor(private readonly health: ScheduleHealthService) {}

  @MessagePattern({ cmd: 'schedule.health' })
  check(@Payload() input: AuthenticatedCommand<Record<string, never>>) {
    return this.health.check(input);
  }
}
