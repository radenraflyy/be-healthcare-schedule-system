import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import type {
  CreateScheduleInput,
  RescheduleInput,
  ScheduleFilterInput,
  SetScheduleStatusInput,
} from './dto/schedule.input.js';
import { SchedulesService } from './schedules.service.js';

@Controller()
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @MessagePattern({ cmd: 'schedule.create' })
  create(@Payload() input: AuthenticatedCommand<CreateScheduleInput>) {
    return this.schedules.createSchedule(input);
  }

  @MessagePattern({ cmd: 'schedule.list' })
  list(@Payload() input: AuthenticatedCommand<ScheduleFilterInput>) {
    return this.schedules.schedules(input);
  }

  @MessagePattern({ cmd: 'schedule.get' })
  get(@Payload() input: AuthenticatedCommand<{ id?: string }>) {
    return this.schedules.schedule(input);
  }

  @MessagePattern({ cmd: 'schedule.delete' })
  delete(@Payload() input: AuthenticatedCommand<{ id?: string }>) {
    return this.schedules.deleteSchedule(input);
  }

  @MessagePattern({ cmd: 'schedule.update_status' })
  updateStatus(@Payload() input: AuthenticatedCommand<SetScheduleStatusInput>) {
    return this.schedules.updateScheduleStatus(input);
  }

  @MessagePattern({ cmd: 'schedule.reschedule' })
  reschedule(@Payload() input: AuthenticatedCommand<RescheduleInput>) {
    return this.schedules.reschedule(input);
  }

  @MessagePattern({ cmd: 'notification.list' })
  notifications(@Payload() input: AuthenticatedCommand<{ page?: number; limit?: number }>) {
    return this.schedules.notifications(input);
  }

  @MessagePattern({ cmd: 'notification.read' })
  markNotificationRead(@Payload() input: AuthenticatedCommand<{ id?: string }>) {
    return this.schedules.markNotificationRead(input);
  }
}
