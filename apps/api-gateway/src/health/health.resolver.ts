import { Inject } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AUTH_SERVICE } from '../../../common/constants/service-tokens.js';

@Resolver()
export class HealthResolver {
  constructor(
    @Inject(AUTH_SERVICE) private readonly authService: ClientProxy,
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
}
