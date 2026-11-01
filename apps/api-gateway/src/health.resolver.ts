import { Inject } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AUTH_SERVICE, SCHEDULE_SERVICE } from './gateway.constants.js';

@Resolver()
export class HealthResolver {
  constructor(
    @Inject(AUTH_SERVICE) private readonly authService: ClientProxy,
    @Inject(SCHEDULE_SERVICE) private readonly scheduleService: ClientProxy,
  ) {}

  @Query(() => String)
  authHealth(): Promise<string> {
    return firstValueFrom(
      this.authService.send<string, Record<string, never>>(
        { cmd: 'auth.health' },
        {},
      ),
    );
  }

  @Query(() => String)
  scheduleHealth(): Promise<string> {
    return firstValueFrom(
      this.scheduleService.send<string, Record<string, never>>(
        { cmd: 'schedule.health' },
        {},
      ),
    );
  }
}
