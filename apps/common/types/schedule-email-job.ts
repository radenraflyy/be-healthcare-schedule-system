export interface ScheduleEmailJob {
  event: 'created' | 'deleted';
  scheduleId: string;
  customerName: string;
  customerEmail: string;
  doctorName: string;
  objective: string;
  scheduledAt: string;
}
