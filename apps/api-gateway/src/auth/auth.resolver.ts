import { Inject } from '@nestjs/common';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientProxy } from '@nestjs/microservices';
import { GraphQLError } from 'graphql';
import { firstValueFrom } from 'rxjs';

import { AUTH_SERVICE } from '../../../common/constants/service-tokens.js';
import { toGraphQLError } from '../common/errors/rpc-error.js';
import type { GraphqlRequestContext } from '../common/types/graphql-context.js';
import { AuthUserView, LoginResultView, UserRoleView } from './auth.types.js';

@Resolver()
export class AuthResolver {
  constructor(@Inject(AUTH_SERVICE) private readonly authService: ClientProxy) {}

  @Mutation(() => AuthUserView, {
    description: 'Membuat akun customer baru. Email harus unik dan password minimal 8 karakter.',
  })
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

  @Mutation(() => LoginResultView, {
    description: 'Memverifikasi email dan password lalu mengembalikan access token JWT.',
  })
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

  @Query(() => AuthUserView, {
    description: 'Memvalidasi access token dan mengembalikan profil pengguna.',
  })
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

  @Mutation(() => AuthUserView, {
    description:
      'Mengubah role customer, doctor, atau admin. Hanya admin yang dapat menjalankan operasi ini.',
  })
  setUserRole(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('role', { type: () => UserRoleView }) role: UserRoleView,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<AuthUserView> {
    const authorization = req?.headers?.authorization;
    const token =
      typeof authorization === 'string'
        ? authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
        : undefined;
    if (!token) {
      throw new GraphQLError('Token akses wajib disertakan pada Authorization header.', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
    return this.sendAuth<AuthUserView, { token: string; userId: string; role: UserRoleView }>(
      { cmd: 'auth.setUserRole' },
      { token, userId, role },
    );
  }

  private async sendAuth<TResult, TInput>(
    pattern: { cmd: string },
    input: TInput,
  ): Promise<TResult> {
    try {
      return await firstValueFrom(this.authService.send<TResult, TInput>(pattern, input));
    } catch (error) {
      throw toGraphQLError(error, 'autentikasi');
    }
  }
}
