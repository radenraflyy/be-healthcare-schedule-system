import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { TracerService } from '@nestjs/observe';
import { randomUUID } from 'node:crypto';

import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import { RedisCacheService } from '../common/redis-cache.service.js';
import { ScheduleOperationService } from '../common/schedule-operation.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SaveWorkflowInput } from './dto/workflow.input.js';
import { normalizeWorkflowSteps } from './workflow.validation.js';

type WorkflowStepRecord = {
  id: string;
  title: string;
  description: string;
  position: number;
};

@Injectable()
export class WorkflowsService extends ScheduleOperationService {
  constructor(
    prisma: PrismaService,
    tracer: TracerService,
    @Inject('AUTH_SERVICE') authService: ClientProxy,
    cache: RedisCacheService,
  ) {
    super(prisma, tracer, authService, cache);
  }

  getWorkflowSteps(payload: AuthenticatedCommand<Record<string, never>>) {
    return this.execute('workflow.get', payload, async (_input, user) => {
      this.assertAdmin(user.role);
      const workflow = await this.prisma.clinicWorkflow.findUnique({
        where: { userId: user.id },
        select: { steps: true },
      });
      return this.toStepRecords(workflow?.steps ?? []);
    });
  }

  saveWorkflowSteps(payload: AuthenticatedCommand<SaveWorkflowInput>) {
    return this.execute('workflow.save', payload, async (input, user) => {
      this.assertAdmin(user.role);
      const drafts = normalizeWorkflowSteps(input?.steps);
      const steps: WorkflowStepRecord[] = drafts.map((step, position) => ({
        ...step,
        id: randomUUID(),
        position,
      }));
      const workflow = await this.prisma.clinicWorkflow.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          steps: steps as unknown as Prisma.InputJsonValue,
        },
        update: { steps: steps as unknown as Prisma.InputJsonValue },
        select: { steps: true },
      });
      return this.toStepRecords(workflow.steps);
    });
  }

  private assertAdmin(role: string) {
    if (role !== 'ADMIN') {
      throw this.rpc('FORBIDDEN', 'Hanya admin yang dapat mengelola workflow klinik.');
    }
  }

  private toStepRecords(value: Prisma.JsonValue): WorkflowStepRecord[] {
    if (!Array.isArray(value)) return [];
    return value
      .flatMap((step) => {
        if (typeof step !== 'object' || step === null || Array.isArray(step)) {
          return [];
        }
        const id = step.id;
        const title = step.title;
        if (typeof id !== 'string' || typeof title !== 'string') return [];
        const description = step.description;
        const position = step.position;
        return [
          {
            id,
            title,
            description: typeof description === 'string' ? description : '',
            position: typeof position === 'number' ? position : 0,
          },
        ];
      })
      .sort((a, b) => a.position - b.position);
  }
}
