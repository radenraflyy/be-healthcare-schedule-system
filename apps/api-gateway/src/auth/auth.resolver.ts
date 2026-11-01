import { Inject } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AUTH_SERVICE } from '../../../common/constants/service-tokens.js';
import { AuthUserView, LoginResultView } from './auth.types.js';
import { toGraphQLError } from '../common/errors/rpc-error.js';
import type { GraphqlRequestContext } from '../common/types/graphql-context.js';

@Resolver()
export class AuthResolver {
  constructor(
    @Inject(AUTH_SERVICE) private readonly authService: ClientProxy,
  ) {}

  @Mutation(() => AuthUserView)
  register(
    @Args('email', { type: () => String }) email: string,
    @Args('password', { type: () => String }) password: string,
    @Args('name', { type: () => String, nullable: true }) name?: string,
    @Context('req') req?: GraphqlRequestContext,
  ): Promise<AuthUserView> {
    return this.sendAuth<
      AuthUserView,
      {
        email: string;
        password: string;
        name?: string;
      }
    >({ cmd: 'auth.register' }, { email, password, name }).then((user) => {
      if (req) req.observeUserId = user.id;
      return user;
    });
  }

  @Mutation(() => LoginResultView)
  login(
    @Args('email', { type: () => String }) email: string,
    @Args('password', { type: () => String }) password: string,
    @Context('req') req?: GraphqlRequestContext,
  ): Promise<LoginResultView> {
    return this.sendAuth<LoginResultView, { email: string; password: string }>(
      { cmd: 'auth.login' },
      { email, password },
    ).then((result) => {
      if (req) req.observeUserId = result.user.id;
      return result;
    });
  }

  @Query(() => AuthUserView)
  validateToken(
    @Args('token', { type: () => String }) token: string,
    @Context('req') req?: GraphqlRequestContext,
  ): Promise<AuthUserView> {
    return this.sendAuth<AuthUserView, { token: string }>(
      { cmd: 'auth.validateToken' },
      { token },
    ).then((user) => {
      if (req) req.observeUserId = user.id;
      return user;
    });
  }

  private async sendAuth<TResult, TInput>(
    pattern: { cmd: string },
    input: TInput,
  ): Promise<TResult> {
    try {
      return await firstValueFrom(
        this.authService.send<TResult, TInput>(pattern, input),
      );
    } catch (error) {
      throw toGraphQLError(error, 'autentikasi');
    }
  }
}
