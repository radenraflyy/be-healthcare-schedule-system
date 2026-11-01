import { RpcServiceException } from './rpc-service.exception.js';

export class ForbiddenException extends RpcServiceException {
  constructor(message: string) {
    super('FORBIDDEN', message);
  }
}
