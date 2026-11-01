import {
  Field,
  GraphQLISODateTime,
  ID,
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

@ObjectType('Customer')
export class CustomerView {
  @Field(() => ID) id: string;
  @Field(() => String) name: string;
  @Field(() => String) email: string;
  @Field(() => GraphQLISODateTime) createdAt: Date;
  @Field(() => GraphQLISODateTime) updatedAt: Date;
}

@ObjectType('Doctor')
export class DoctorView {
  @Field(() => ID) id: string;
  @Field(() => String) name: string;
  @Field(() => GraphQLISODateTime) createdAt: Date;
  @Field(() => GraphQLISODateTime) updatedAt: Date;
}

@ObjectType('Schedule')
export class ScheduleView {
  @Field(() => ID) id: string;
  @Field(() => String) objective: string;
  @Field(() => ID) customerId: string;
  @Field(() => ID) doctorId: string;
  @Field(() => GraphQLISODateTime) scheduledAt: Date;
  @Field(() => ScheduleStatus) status: ScheduleStatus;
  @Field(() => GraphQLISODateTime) createdAt: Date;
  @Field(() => GraphQLISODateTime) updatedAt: Date;
  @Field(() => CustomerView) customer: CustomerView;
  @Field(() => DoctorView) doctor: DoctorView;
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
