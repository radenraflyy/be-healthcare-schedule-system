import { Inject } from '@nestjs/common';
import {
  Args,
  Context,
  GraphQLISODateTime,
  ID,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { GraphQLError } from 'graphql';
import { SCHEDULE_SERVICE } from '../../../common/constants/service-tokens.js';
import { toGraphQLError } from '../common/errors/rpc-error.js';
import type { GraphqlRequestContext } from '../common/types/graphql-context.js';
import type {
  AuthenticatedCommand,
  AuthenticatedResult,
} from '../../../common/types/authenticated-command.js';
import {
  CustomerPageView,
  CustomerView,
  DoctorPageView,
  DoctorView,
  SchedulePageView,
  ScheduleStatus,
  ScheduleView,
} from './schedule.types.js';

@Resolver()
export class ScheduleResolver {
  constructor(
    @Inject(SCHEDULE_SERVICE) private readonly scheduleService: ClientProxy,
  ) {}

  @Query(() => String)
  scheduleHealth(@Context('req') req: GraphqlRequestContext): Promise<string> {
    return this.send('schedule.health', {}, req);
  }

  @Mutation(() => CustomerView)
  createCustomer(
    @Args('name', { type: () => String }) name: string,
    @Args('email', { type: () => String }) email: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<CustomerView> {
    return this.send('customer.create', { name, email }, req);
  }

  @Mutation(() => CustomerView)
  updateCustomer(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { type: () => String, nullable: true })
    name: string | undefined,
    @Args('email', { type: () => String, nullable: true })
    email: string | undefined,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<CustomerView> {
    return this.send('customer.update', { id, name, email }, req);
  }

  @Query(() => CustomerPageView)
  customers(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Context('req') req: GraphqlRequestContext,
  ) {
    return this.send('customer.list', { page, limit }, req);
  }

  @Query(() => CustomerView)
  customer(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<CustomerView> {
    return this.send('customer.get', { id }, req);
  }

  @Mutation(() => Boolean)
  deleteCustomer(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<boolean> {
    return this.send('customer.delete', { id }, req);
  }

  @Mutation(() => DoctorView)
  createDoctor(
    @Args('name', { type: () => String }) name: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<DoctorView> {
    return this.send('doctor.create', { name }, req);
  }

  @Mutation(() => DoctorView)
  updateDoctor(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { type: () => String }) name: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<DoctorView> {
    return this.send('doctor.update', { id, name }, req);
  }

  @Query(() => DoctorPageView)
  doctors(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Context('req') req: GraphqlRequestContext,
  ) {
    return this.send('doctor.list', { page, limit }, req);
  }

  @Query(() => DoctorView)
  doctor(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<DoctorView> {
    return this.send('doctor.get', { id }, req);
  }

  @Mutation(() => Boolean)
  deleteDoctor(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<boolean> {
    return this.send('doctor.delete', { id }, req);
  }

  @Mutation(() => ScheduleView)
  createSchedule(
    @Args('objective', { type: () => String }) objective: string,
    @Args('customerId', { type: () => ID }) customerId: string,
    @Args('doctorId', { type: () => ID }) doctorId: string,
    @Args('scheduledAt', { type: () => GraphQLISODateTime }) scheduledAt: Date,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<ScheduleView> {
    return this.send(
      'schedule.create',
      { objective, customerId, doctorId, scheduledAt },
      req,
    );
  }

  @Query(() => SchedulePageView)
  schedules(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Args('customerId', { type: () => ID, nullable: true })
    customerId: string | undefined,
    @Args('doctorId', { type: () => ID, nullable: true })
    doctorId: string | undefined,
    @Args('status', { type: () => ScheduleStatus, nullable: true })
    status: ScheduleStatus | undefined,
    @Args('from', { type: () => GraphQLISODateTime, nullable: true })
    from: Date | undefined,
    @Args('to', { type: () => GraphQLISODateTime, nullable: true })
    to: Date | undefined,
    @Context('req') req: GraphqlRequestContext,
  ) {
    return this.send(
      'schedule.list',
      { page, limit, customerId, doctorId, status, from, to },
      req,
    );
  }

  @Query(() => ScheduleView)
  schedule(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<ScheduleView> {
    return this.send('schedule.get', { id }, req);
  }

  @Mutation(() => Boolean)
  deleteSchedule(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<boolean> {
    return this.send('schedule.delete', { id }, req);
  }

  private async send<TResult, TInput>(
    command: string,
    input: TInput,
    req: GraphqlRequestContext,
  ): Promise<TResult> {
    const token = this.readToken(req);
    try {
      const result = await firstValueFrom(
        this.scheduleService.send<
          AuthenticatedResult<TResult>,
          AuthenticatedCommand<TInput>
        >({ cmd: command }, { token, input }),
      );
      if (req) req.observeUserId = result.userId;
      return result.data;
    } catch (error) {
      throw toGraphQLError(error, 'schedule atau autentikasi');
    }
  }

  private readToken(req?: GraphqlRequestContext): string {
    const authorization = req?.headers?.authorization;
    const match =
      typeof authorization === 'string'
        ? authorization.match(/^Bearer\s+(.+)$/i)
        : null;
    if (!match?.[1]?.trim()) {
      throw new GraphQLError(
        'Token akses wajib disertakan pada Authorization header.',
        {
          extensions: { code: 'UNAUTHENTICATED' },
        },
      );
    }
    return match[1].trim();
  }
}
