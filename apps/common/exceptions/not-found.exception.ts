import { RpcServiceException } from './rpc-service.exception.js';

export class NotFoundException extends RpcServiceException {
  constructor(message: string) {
    super('NOT_FOUND', message);
  }
}
