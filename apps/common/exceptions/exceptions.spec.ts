import { describe, expect, it } from 'vitest';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  RpcServiceException,
  ServiceErrorException,
  ServiceUnavailableException,
  TooManyRequestsException,
  UnauthorizedException,
} from './index.js';

describe('RPC exception types', () => {
  it.each([
    [BadRequestException, 'BAD_USER_INPUT'],
    [UnauthorizedException, 'UNAUTHENTICATED'],
    [ForbiddenException, 'FORBIDDEN'],
    [NotFoundException, 'NOT_FOUND'],
    [ConflictException, 'CONFLICT'],
    [ServiceUnavailableException, 'SERVICE_UNAVAILABLE'],
    [ServiceErrorException, 'SERVICE_ERROR'],
    [TooManyRequestsException, 'THROTTLED'],
  ])('maps %s to %s', (ExceptionType, code) => {
    const error = new ExceptionType('Helpful message');
    expect(error.getError()).toEqual({ code, message: 'Helpful message' });
  });

  it('supports application-specific RPC codes', () => {
    expect(new RpcServiceException('CUSTOM', 'Custom message').getError()).toEqual({
      code: 'CUSTOM',
      message: 'Custom message',
    });
  });
});
