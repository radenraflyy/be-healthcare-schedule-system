import { Inject } from '@nestjs/common';
import {
  Args,
  Context,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { ClientProxy } from '@nestjs/microservices';
import { GraphQLError } from 'graphql';
import { firstValueFrom } from 'rxjs';
import { AUTH_SERVICE } from './gateway.constants.js';

interface ObserveRequest {
  observeUserId?: string;
}

interface RpcErrorPayload {
  code?: string;
  message?: string;
  error?: unknown;
  response?: unknown;
}

function toGraphQLError(error: unknown): GraphQLError {
  const details = findRpcErrorDetails(error);
  if (details.code === 'BAD_USER_INPUT' || details.code === 'CONFLICT') {
    return new GraphQLError(details.message, {
      extensions: { code: details.code },
    });
  }
  if (details.code === 'UNAUTHENTICATED') {
    return new GraphQLError(details.message, {
      extensions: { code: details.code },
    });
  }
  if (details.code === 'SERVICE_UNAVAILABLE') {
    return new GraphQLError(details.message, {
      extensions: { code: details.code },
    });
  }
  if (details.code === 'SERVICE_ERROR') {
    return new GraphQLError(details.message, {
      extensions: { code: details.code },
    });
  }
  if (
    details.code === 'INTERNAL_SERVER_ERROR' &&
    details.message !== 'Internal server error'
  ) {
    return new GraphQLError(details.message, {
      extensions: { code: details.code },
    });
  }

  const originalMessage = error instanceof Error ? error.message : '';
  if (/ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT/.test(originalMessage)) {
    return new GraphQLError(
      'Layanan autentikasi sedang tidak tersedia. Pastikan auth service berjalan lalu coba lagi.',
      { extensions: { code: 'SERVICE_UNAVAILABLE' } },
    );
  }

  return new GraphQLError(
    'Terjadi kendala saat memproses permintaan. Coba lagi sebentar.',
    { extensions: { code: 'INTERNAL_SERVER_ERROR' } },
  );
}

function findRpcErrorDetails(error: unknown): {
  code?: string;
  message: string;
} {
  const visited = new Set<unknown>();
  const queue: unknown[] = [error];

  while (queue.length > 0) {
    const value = queue.shift();
    if (!value || visited.has(value)) continue;
    if (typeof value === 'string') {
      try {
        queue.push(JSON.parse(value));
      } catch {
        // String messages are inspected through the containing error object.
      }
      continue;
    }
    if (typeof value !== 'object') continue;
    visited.add(value);
    const record = value as RpcErrorPayload;
    if (typeof record.code === 'string' && typeof record.message === 'string') {
      return { code: record.code, message: record.message };
    }
    if (typeof record.message === 'object') queue.push(record.message);
    if (typeof record.error === 'object' || typeof record.error === 'string') {
      queue.push(record.error);
    }
    if (
      typeof record.response === 'object' ||
      typeof record.response === 'string'
    ) {
      queue.push(record.response);
    }
  }

  return { message: 'Internal server error' };
}

@ObjectType('AuthUser')
class AuthUserView {
  @Field(() => String)
  id: string;

  @Field(() => String)
  email: string;

  @Field(() => String, { nullable: true })
  name: string | null;

  @Field(() => String)
  createdAt: string;
}

@ObjectType('LoginResult')
class LoginResultView {
  @Field(() => String)
  accessToken: string;

  @Field(() => String)
  tokenType: string;

  @Field(() => Number)
  expiresIn: number;

  @Field(() => AuthUserView)
  user: AuthUserView;
}

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
    @Context('req') req?: ObserveRequest,
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
    @Context('req') req?: ObserveRequest,
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
    @Context('req') req?: ObserveRequest,
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
      throw toGraphQLError(error);
    }
  }
}
