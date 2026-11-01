import { RpcServiceException } from './rpc-service.exception.js';

export class UnauthorizedException extends RpcServiceException {
  constructor(message: string) {
    super('UNAUTHENTICATED', message);
  }
}
