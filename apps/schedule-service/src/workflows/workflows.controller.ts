import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import type { SaveWorkflowInput } from './dto/workflow.input.js';
import { WorkflowsService } from './workflows.service.js';

@Controller()
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @MessagePattern({ cmd: 'workflow.get' })
  get(@Payload() input: AuthenticatedCommand<Record<string, never>>) {
    return this.workflows.getWorkflowSteps(input);
  }

  @MessagePattern({ cmd: 'workflow.save' })
  save(@Payload() input: AuthenticatedCommand<SaveWorkflowInput>) {
    return this.workflows.saveWorkflowSteps(input);
  }
}
