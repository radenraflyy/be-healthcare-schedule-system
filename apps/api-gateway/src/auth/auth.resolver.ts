import { Inject } from '@nestjs/common';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClientProxy } from '@nestjs/microservices';
import { GraphQLError } from 'graphql';
import { firstValueFrom } from 'rxjs';

import { AUTH_SERVICE } from '../../../common/constants/service-tokens.js';
import { toGraphQLError } from '../common/errors/rpc-error.js';
import type {
  GraphqlRequestContext,
  GraphqlResolverContext,
} from '../common/types/graphql-context.js';
import { AuthUserView, LoginResultView, UserRoleView } from './auth.types.js';

@Resolver()
export class AuthResolver {
  constructor(@Inject(AUTH_SERVICE) private readonly authService: ClientProxy) {}

  @Mutation(() => AuthUserView, {
    description:
      'Mendaftarkan pengguna baru dengan email, password, dan nama. Mengembalikan profil pengguna yang baru dibuat.',
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
    @Context() context: GraphqlResolverContext,
  ): Promise<LoginResultView> {
    return this.sendAuth<LoginResultView, { email: string; password: string }>(
      { cmd: 'auth.login' },
      { email, password },
    )
      .then((result) => {
        context.req.observeUserId = result.user.id;
        return result;
      })
      .catch((error: unknown) => {
        if (error instanceof GraphQLError && error.extensions.code === 'TOO_MANY_REQUESTS') {
          const limit = Number(error.extensions.limit ?? 0);
          const remaining = Number(error.extensions.remaining ?? 0);
          const retryAfterSeconds = Number(error.extensions.retryAfterSeconds ?? 0);
          context.res.setHeader('RateLimit-Limit', String(limit));
          context.res.setHeader('RateLimit-Remaining', String(remaining));
          context.res.setHeader('RateLimit-Reset', String(retryAfterSeconds));
          context.res.setHeader('Retry-After', String(retryAfterSeconds));
        }
        throw error;
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

  @Mutation(() => Boolean, {
    description: 'Logout',
  })
  logout(@Context('req') req?: GraphqlRequestContext): Promise<boolean> {
    const authorization = req?.headers?.authorization;
    const token =
      typeof authorization === 'string'
        ? authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
        : undefined;
    if (!token) {
      throw new GraphQLError('Akses token required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
    return this.sendAuth<boolean, { token: string }>({ cmd: 'auth.logout' }, { token });
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
      throw new GraphQLError('Akses token required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
    return this.sendAuth<AuthUserView, { token: string; userId: string; role: UserRoleView }>(
      { cmd: 'auth.setUserRole' },
      { token, userId, role },
    );
  }

  @Query(() => [AuthUserView], {
    description: 'Mengambil daftar pengguna untuk dikelola admin.',
  })
  adminUsers(@Context('req') req: GraphqlRequestContext): Promise<AuthUserView[]> {
    const token = this.getToken(req);
    return this.sendAuth<AuthUserView[], { token: string }>({ cmd: 'auth.adminUsers' }, { token });
  }

  @Mutation(() => AuthUserView, {
    description:
      'Membuat akun pengguna dengan role pilihan. Hanya admin yang dapat menjalankan operasi ini.',
  })
  createManagedUser(
    @Args('email', { type: () => String }) email: string,
    @Args('password', { type: () => String }) password: string,
    @Args('role', { type: () => UserRoleView }) role: UserRoleView,
    @Args('name', { type: () => String, nullable: true }) name: string | undefined,
    @Context('req') req: GraphqlRequestContext,
  ): Promise<AuthUserView> {
    const token = this.getToken(req);
    return this.sendAuth<
      AuthUserView,
      { token: string; email: string; password: string; role: UserRoleView; name?: string }
    >({ cmd: 'auth.createManagedUser' }, { token, email, password, role, name });
  }

  private getToken(req: GraphqlRequestContext): string {
    const authorization = req?.headers?.authorization;
    const token =
      typeof authorization === 'string'
        ? authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
        : undefined;
    if (!token) {
      throw new GraphQLError('Akses token required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
    return token;
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
