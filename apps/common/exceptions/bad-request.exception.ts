import { RpcServiceException } from './rpc-service.exception.js';

export class BadRequestException extends RpcServiceException {
  constructor(message: string) {
    super('BAD_USER_INPUT', message);
  }
}
