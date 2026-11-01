import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

export enum ScheduleStatus {
  REQUESTED = 'REQUESTED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

registerEnumType(ScheduleStatus, { name: 'ScheduleStatus' });

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
}
registerEnumType(CustomerStatus, { name: 'CustomerStatus' });

@ObjectType('Customer', {
  description: 'Profil customer yang membuat janji temu.',
})
export class CustomerView {
  @Field(() => ID) id: string;
  @Field(() => ID, { nullable: true }) userId: string | null;
  @Field(() => String) name: string;
  @Field(() => String) email: string;
  @Field(() => String, { nullable: true }) phone: string | null;
  @Field(() => String, { nullable: true }) gender: string | null;
  @Field(() => GraphQLISODateTime, { nullable: true }) birthDate: Date | null;
  @Field(() => String, { nullable: true }) address: string | null;
  @Field(() => String, { nullable: true }) treatment: string | null;
  @Field(() => CustomerStatus, { nullable: true }) status: CustomerStatus | null;
  @Field(() => GraphQLISODateTime, { nullable: true }) nextVisit: Date | null;
  @Field(() => String, { nullable: true }) note: string | null;
  @Field(() => GraphQLISODateTime) createdAt: Date;
  @Field(() => GraphQLISODateTime) updatedAt: Date;
}

@ObjectType('WorkflowStep', {
  description: 'Satu langkah pada workflow klinik milik admin.',
})
export class WorkflowStepView {
  @Field(() => ID) id: string;
  @Field(() => String) title: string;
  @Field(() => String) description: string;
  @Field(() => Int) position: number;
}

@InputType('WorkflowStepInput')
export class WorkflowStepInputView {
  @Field(() => String) title: string;
  @Field(() => String, { nullable: true }) description?: string;
}

@ObjectType('Doctor', {
  description: 'Profil dokter dan jadwal konsultasinya.',
})
export class DoctorView {
  @Field(() => ID) id: string;
  @Field(() => String) name: string;
  @Field(() => GraphQLISODateTime) createdAt: Date;
  @Field(() => GraphQLISODateTime) updatedAt: Date;
}

@ObjectType('Schedule', {
  description: 'Janji temu customer dengan dokter beserta status dan waktu konsultasi.',
})
export class ScheduleView {
  @Field(() => ID) id: string;
  @Field(() => String) objective: string;
  @Field(() => ID) customerId: string;
  @Field(() => ID) doctorId: string;
  @Field(() => GraphQLISODateTime) scheduledAt: Date;
  @Field(() => ScheduleStatus) status: ScheduleStatus;
  @Field(() => Int) durationMinutes: number;
  @Field(() => String, { nullable: true }) cancelReason: string | null;
  @Field(() => GraphQLISODateTime) createdAt: Date;
  @Field(() => GraphQLISODateTime) updatedAt: Date;
  @Field(() => CustomerView) customer: CustomerView;
  @Field(() => DoctorView) doctor: DoctorView;
}

@ObjectType('DoctorAvailability', {
  description: 'Jam praktik mingguan dokter. Waktu disimpan dalam UTC.',
})
export class DoctorAvailabilityView {
  @Field(() => ID) id: string;
  @Field(() => ID) doctorId: string;
  @Field(() => Int) dayOfWeek: number;
  @Field(() => String) startTime: string;
  @Field(() => String) endTime: string;
  @Field(() => Int) slotMinutes: number;
}

@ObjectType('Notification', {
  description: 'Pengingat dan pembaruan janji temu untuk pengguna yang sedang login.',
})
export class NotificationView {
  @Field(() => ID) id: string;
  @Field(() => ID, { nullable: true }) scheduleId: string | null;
  @Field(() => String) title: string;
  @Field(() => String) message: string;
  @Field(() => GraphQLISODateTime) createdAt: Date;
  @Field(() => GraphQLISODateTime, { nullable: true }) readAt: Date | null;
}

export function pageType<TItem>(name: string, item: new () => TItem) {
  @ObjectType(name)
  class PageView {
    @Field(() => [item]) items: TItem[];
    @Field(() => Int) page: number;
    @Field(() => Int) limit: number;
    @Field(() => Int) total: number;
    @Field(() => Int) totalPages: number;
  }
  return PageView;
}

export const CustomerPageView = pageType('CustomerPage', CustomerView);
export const DoctorPageView = pageType('DoctorPage', DoctorView);
export const SchedulePageView = pageType('SchedulePage', ScheduleView);
export const NotificationPageView = pageType('NotificationPage', NotificationView);
