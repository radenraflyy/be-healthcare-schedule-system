import { RpcServiceException } from './rpc-service.exception.js';

export class ConflictException extends RpcServiceException {
  constructor(message: string) {
    super('CONFLICT', message);
  }
}
