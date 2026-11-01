import { Injectable } from '@nestjs/common';
import { TracerService } from '@nestjs/observe';

@Injectable()
export class ScheduleService {
  constructor(private readonly tracer: TracerService) {}

  async getHello(): Promise<string> {
    const operations = this.tracer.counter('schedule_operations_total', {
      description:
        'Schedule service operations grouped by operation and outcome',
      labels: ['operation', 'outcome'],
    });
    const duration = this.tracer.summary('schedule_operation_duration_ms', {
      description: 'Schedule service operation duration in milliseconds',
      labels: ['health_check'],
    });
    const startedAt = performance.now();

    return this.tracer.createSpan('schedule.health_check', async (span) => {
      span.setTag('operation', 'health_check');
      try {
        const result = 'Hello World!';
        operations.increment({ operation: 'health_check', outcome: 'success' });
        return result;
      } catch (error) {
        span.setTag('outcome', 'error');
        operations.increment({ operation: 'health_check', outcome: 'error' });
        throw error;
      } finally {
        duration.observe(performance.now() - startedAt, 'health_check');
      }
    });
  }
}
