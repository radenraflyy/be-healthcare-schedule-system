import { RpcServiceException } from './rpc-service.exception.js';

export class TooManyRequestsException extends RpcServiceException {
  constructor(
    message: string,
    metadata: { limit: number; remaining: number; retryAfterSeconds: number },
  ) {
    super('TOO_MANY_REQUESTS', message, metadata);
  }
}
