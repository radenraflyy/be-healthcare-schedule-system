import { Inject } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

import { AUTH_SERVICE } from '../../../common/constants/service-tokens.js';
import { toGraphQLError } from '../common/errors/rpc-error.js';

@Resolver()
export class HealthResolver {
  constructor(@Inject(AUTH_SERVICE) private readonly authService: ClientProxy) {}

  @Query(() => String)
  async authHealth(): Promise<string> {
    try {
      return await firstValueFrom(
        this.authService
          .send<string, Record<string, never>>({ cmd: 'auth.health' }, {})
          .pipe(timeout({ first: 5_000 })),
      );
    } catch (error) {
      throw toGraphQLError(error, 'autentikasi');
    }
  }
}
