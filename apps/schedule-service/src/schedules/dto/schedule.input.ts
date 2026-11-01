import type { PageInput } from '../../common/types/pagination.js';

export interface CreateScheduleInput {
  objective?: string;
  customerId?: string;
  doctorId?: string;
  scheduledAt?: string | Date;
}

export interface ScheduleFilterInput extends PageInput {
  customerId?: string;
  doctorId?: string;
  status?: 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  from?: string | Date;
  to?: string | Date;
}
