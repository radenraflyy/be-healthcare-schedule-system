import type { PageInput } from '../../common/types/pagination.js';

export interface CreateScheduleInput {
  objective?: string;
  customerId?: string;
  doctorId?: string;
  scheduledAt?: string | Date;
}

export interface SetScheduleStatusInput {
  id?: string;
  status?: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  cancelReason?: string;
}

export interface RescheduleInput {
  id?: string;
  scheduledAt?: string | Date;
}

export interface SetAvailabilityInput {
  doctorId?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  slotMinutes?: number;
}

export interface ScheduleFilterInput extends PageInput {
  customerId?: string;
  doctorId?: string;
  status?: 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  from?: string | Date;
  to?: string | Date;
}
