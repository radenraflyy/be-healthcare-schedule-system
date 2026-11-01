import { RpcServiceException } from './rpc-service.exception.js';

export class ServiceErrorException extends RpcServiceException {
  constructor(message: string) {
    super('SERVICE_ERROR', message);
  }
}
