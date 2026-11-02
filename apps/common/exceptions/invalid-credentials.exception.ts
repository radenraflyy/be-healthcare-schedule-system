import { RpcServiceException } from './rpc-service.exception.js';

export class InvalidCredentialsException extends RpcServiceException {
  constructor(message: string) {
    super('INVALID_CREDENTIALS', message);
  }
}
