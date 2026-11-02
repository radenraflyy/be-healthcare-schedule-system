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
import { GraphQLError } from 'graphql';
import { firstValueFrom, timeout } from 'rxjs';

import { SCHEDULE_SERVICE } from '../../../common/constants/service-tokens.js';
import type {
  AuthenticatedCommand,
  AuthenticatedResult,
} from '../../../common/types/authenticated-command.js';
import { toGraphQLError } from '../common/errors/rpc-error.js';
import type { GraphqlRequestContext } from '../common/types/graphql-context.js';
import { reviveGraphqlDates } from '../common/utils/revive-graphql-dates.js';
import {
  CustomerPageView,
  CustomerStatus,
  CustomerView,
  DoctorAccountLinkView,
  DoctorAvailabilityView,
  DoctorPageView,
  DoctorView,
  NotificationPageView,
  SchedulePageView,
  ScheduleStatus,
  ScheduleView,
  WorkflowStepInputView,
  WorkflowStepView,
} from './schedule.types.js';

@Resolver()
export class ScheduleResolver {
  constructor(@Inject(SCHEDULE_SERVICE) private readonly scheduleService: ClientProxy) {}

  @Query(() => String, {
    description: 'Memeriksa status schedule service. Tetap memerlukan access token.',
  })
  scheduleHealth(@Context('req') req: GraphqlRequestContext): Promise<string> {
    return this.send('schedule.health', {}, req);
  }

  @Mutation(() => CustomerView, {
    description: 'Membuat profil customer. Admin dapat menghubungkan profil ke user.',
  })
  createCustomer(
    @Args('name', { type: () => String }) name: string,
    @Args('email', { type: () => String }) email: string,
    @Args('userId', { type: () => ID, nullable: true })
    userId: string | undefined,
    @Args('phone', { type: () => String, nullable: true }) phone: string | undefined,
    @Args('gender', { type: () => String, nullable: true }) gender: string | undefined,
    @Args('birthDate', { type: () => GraphQLISODateTime, nullable: true })
    birthDate: Date | undefined,
    @Args('address', { type: () => String, nullable: true }) address: string | undefined,
    @Args('treatment', { type: () => String, nullable: true }) treatment: string | undefined,
    @Args('status', { type: () => CustomerStatus, nullable: true })
    status: CustomerStatus | undefined,
    @Args('nextVisit', { type: () => GraphQLISODateTime, nullable: true })
    nextVisit: Date | undefined,
    @Args('note', { type: () => String, nullable: true }) note: string | undefined,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<CustomerView> {
    return this.send(
      'customer.create',
      {
        name,
        email,
        userId,
        phone,
        gender,
        birthDate,
        address,
        treatment,
        status,
        nextVisit,
        note,
      },
      req,
    );
  }

  @Mutation(() => CustomerView, {
    description: 'Memperbarui data customer yang sudah ada.',
  })
  updateCustomer(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { type: () => String, nullable: true })
    name: string | undefined,
    @Args('email', { type: () => String, nullable: true })
    email: string | undefined,
    @Args('userId', { type: () => ID, nullable: true })
    userId: string | undefined,
    @Args('phone', { type: () => String, nullable: true }) phone: string | undefined,
    @Args('gender', { type: () => String, nullable: true }) gender: string | undefined,
    @Args('birthDate', { type: () => GraphQLISODateTime, nullable: true })
    birthDate: Date | undefined,
    @Args('address', { type: () => String, nullable: true }) address: string | undefined,
    @Args('treatment', { type: () => String, nullable: true }) treatment: string | undefined,
    @Args('status', { type: () => CustomerStatus, nullable: true })
    status: CustomerStatus | undefined,
    @Args('nextVisit', { type: () => GraphQLISODateTime, nullable: true })
    nextVisit: Date | undefined,
    @Args('note', { type: () => String, nullable: true }) note: string | undefined,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<CustomerView> {
    return this.send(
      'customer.update',
      {
        id,
        name,
        email,
        userId,
        phone,
        gender,
        birthDate,
        address,
        treatment,
        status,
        nextVisit,
        note,
      },
      req,
    );
  }

  @Query(() => CustomerPageView, {
    description:
      'Mengambil daftar customer dengan pagination. Admin dapat melihat seluruh customer.',
  })
  customers(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Context('req') req: GraphqlRequestContext,
  ) {
    return this.send('customer.list', { page, limit }, req);
  }

  @Query(() => CustomerView, {
    description: 'Mengambil customer berdasarkan UUID.',
  })
  customer(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<CustomerView> {
    return this.send('customer.get', { id }, req);
  }

  @Mutation(() => Boolean, {
    description: 'Menghapus customer yang tidak memiliki jadwal terkait.',
  })
  deleteCustomer(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<boolean> {
    return this.send('customer.delete', { id }, req);
  }

  @Mutation(() => DoctorView, {
    description: 'Membuat profil dokter dan menghubungkannya ke akun dokter.',
  })
  createDoctor(
    @Args('name', { type: () => String }) name: string,
    @Args('userId', { type: () => ID, nullable: true })
    userId: string | undefined,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<DoctorView> {
    return this.send('doctor.create', { name, userId }, req);
  }

  @Mutation(() => DoctorView, { description: 'Memperbarui profil dokter.' })
  updateDoctor(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { type: () => String }) name: string,
    @Args('userId', { type: () => ID, nullable: true })
    userId: string | undefined,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<DoctorView> {
    return this.send('doctor.update', { id, name, userId }, req);
  }

  @Query(() => DoctorPageView, {
    description: 'Mengambil daftar dokter dengan pagination.',
  })
  doctors(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Context('req') req: GraphqlRequestContext,
  ) {
    return this.send('doctor.list', { page, limit }, req);
  }

  @Query(() => [DoctorView], {
    description: 'Mengambil profil dokter yang belum ditautkan ke akun.',
  })
  unlinkedDoctors(@Context('req') req: GraphqlRequestContext): Promise<DoctorView[]> {
    return this.send('doctor.unlinked', {}, req);
  }

  @Query(() => [DoctorAccountLinkView], {
    description: 'Mengambil nama profil dokter yang tertaut ke akun, hanya untuk admin.',
  })
  doctorAccountLinks(@Context('req') req: GraphqlRequestContext): Promise<DoctorAccountLinkView[]> {
    return this.send('doctor.links', {}, req);
  }

  @Query(() => DoctorView, {
    description: 'Mengambil dokter berdasarkan UUID.',
  })
  doctor(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<DoctorView> {
    return this.send('doctor.get', { id }, req);
  }

  @Query(() => DoctorView, {
    description: 'Mengambil profil dokter yang terhubung ke akun dokter saat ini.',
  })
  myDoctor(@Context('req') req: GraphqlRequestContext): Promise<DoctorView> {
    return this.send('doctor.me', {}, req);
  }

  @Mutation(() => Boolean, {
    description: 'Menghapus dokter yang tidak memiliki jadwal terkait.',
  })
  deleteDoctor(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<boolean> {
    return this.send('doctor.delete', { id }, req);
  }

  @Query(() => [DoctorAvailabilityView], {
    description: 'Mengambil seluruh jam praktik mingguan dokter.',
  })
  doctorAvailabilities(
    @Args('doctorId', { type: () => ID }) doctorId: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<DoctorAvailabilityView[]> {
    return this.send('availability.windows', { doctorId }, req);
  }

  @Mutation(() => ScheduleView, {
    description:
      'Membuat janji temu pada slot ketersediaan dokter. Customer memesan untuk akunnya sendiri.',
  })
  createSchedule(
    @Args('objective', { type: () => String }) objective: string,
    @Args('customerId', { type: () => ID, nullable: true })
    customerId: string | undefined,
    @Args('doctorId', { type: () => ID }) doctorId: string,
    @Args('scheduledAt', { type: () => GraphQLISODateTime }) scheduledAt: Date,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<ScheduleView> {
    return this.send('schedule.create', { objective, customerId, doctorId, scheduledAt }, req);
  }

  @Mutation(() => DoctorAvailabilityView, {
    description: 'Mengatur jam praktik mingguan dokter dalam UTC dan durasi setiap slot.',
  })
  setDoctorAvailability(
    @Args('doctorId', { type: () => ID }) doctorId: string,
    @Args('dayOfWeek', { type: () => Int }) dayOfWeek: number,
    @Args('startTime', { type: () => String }) startTime: string,
    @Args('endTime', { type: () => String }) endTime: string,
    @Args('slotMinutes', { type: () => Int, defaultValue: 30 })
    slotMinutes: number,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<DoctorAvailabilityView> {
    return this.send(
      'availability.set',
      { doctorId, dayOfWeek, startTime, endTime, slotMinutes },
      req,
    );
  }

  @Mutation(() => Boolean, {
    description: 'Menghapus satu jadwal ketersediaan dokter.',
  })
  deleteDoctorAvailability(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<boolean> {
    return this.send('availability.delete', { id }, req);
  }

  @Query(() => [GraphQLISODateTime], {
    description: 'Mengambil slot konsultasi yang masih tersedia pada tanggal UTC tertentu.',
  })
  availableSlots(
    @Args('doctorId', { type: () => ID }) doctorId: string,
    @Args('date', { type: () => GraphQLISODateTime }) date: Date,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<Date[]> {
    return this.send('availability.list', { doctorId, date }, req);
  }

  @Query(() => SchedulePageView, {
    description:
      'Mengambil daftar jadwal dengan filter customer, dokter, status, tanggal, dan pagination.',
  })
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
    return this.send('schedule.list', { page, limit, customerId, doctorId, status, from, to }, req);
  }

  @Query(() => ScheduleView, {
    description: 'Mengambil detail janji temu berdasarkan UUID sesuai hak akses pengguna.',
  })
  schedule(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<ScheduleView> {
    return this.send('schedule.get', { id }, req);
  }

  @Mutation(() => Boolean, {
    description: 'Menghapus jadwal sebagai admin dan mengantrekan email pemberitahuan customer.',
  })
  deleteSchedule(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<boolean> {
    return this.send('schedule.delete', { id }, req);
  }

  @Mutation(() => ScheduleView, {
    description:
      'Mengonfirmasi, membatalkan, atau menyelesaikan janji temu sesuai role dan alur status.',
  })
  updateScheduleStatus(
    @Args('id', { type: () => ID }) id: string,
    @Args('status', { type: () => ScheduleStatus }) status: ScheduleStatus,
    @Args('cancelReason', { type: () => String, nullable: true })
    cancelReason: string | undefined,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<ScheduleView> {
    return this.send('schedule.update_status', { id, status, cancelReason }, req);
  }

  @Mutation(() => ScheduleView, {
    description: 'Menjadwalkan ulang janji yang masih berstatus REQUESTED ke slot yang tersedia.',
  })
  reschedule(
    @Args('id', { type: () => ID }) id: string,
    @Args('scheduledAt', { type: () => GraphQLISODateTime }) scheduledAt: Date,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<ScheduleView> {
    return this.send('schedule.reschedule', { id, scheduledAt }, req);
  }

  @Query(() => NotificationPageView, {
    description: 'Mengambil pengingat janji temu milik pengguna yang sedang login.',
  })
  notifications(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Context('req') req: GraphqlRequestContext,
  ) {
    return this.send('notification.list', { page, limit }, req);
  }

  @Mutation(() => Boolean, {
    description: 'Menandai notifikasi milik pengguna sebagai sudah dibaca.',
  })
  markNotificationRead(
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<boolean> {
    return this.send('notification.read', { id }, req);
  }

  @Query(() => [WorkflowStepView], {
    description: 'Mengambil langkah workflow milik admin yang sedang login.',
  })
  workflowSteps(@Context('req') req: GraphqlRequestContext): Promise<WorkflowStepView[]> {
    return this.send('workflow.get', {}, req);
  }

  @Mutation(() => [WorkflowStepView], {
    description: 'Mengganti dan menyimpan seluruh urutan langkah workflow admin yang sedang login.',
  })
  saveWorkflowSteps(
    @Args('steps', { type: () => [WorkflowStepInputView] })
    steps: WorkflowStepInputView[],
    @Context('req') req: GraphqlRequestContext,
  ): Promise<WorkflowStepView[]> {
    return this.send('workflow.save', { steps }, req);
  }

  private async send<TResult, TInput>(
    command: string,
    input: TInput,
    req: GraphqlRequestContext,
  ): Promise<TResult> {
    const token = this.readToken(req);
    try {
      const result = await firstValueFrom(
        this.scheduleService
          .send<AuthenticatedResult<TResult>, AuthenticatedCommand<TInput>>(
            { cmd: command },
            { token, input },
          )
          .pipe(timeout({ first: 5_000 })),
      );
      if (req) req.observeUserId = result.userId;
      return reviveGraphqlDates(result.data, command === 'availability.list');
    } catch (error) {
      throw toGraphQLError(error, 'schedule atau autentikasi');
    }
  }

  private readToken(req?: GraphqlRequestContext): string {
    const authorization = req?.headers?.authorization;
    const match =
      typeof authorization === 'string' ? authorization.match(/^Bearer\s+(.+)$/i) : null;
    if (!match?.[1]?.trim()) {
      throw new GraphQLError('Token akses wajib disertakan pada Authorization header.', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
    return match[1].trim();
  }
}
