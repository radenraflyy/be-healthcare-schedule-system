import { RpcServiceException } from './rpc-service.exception.js';

export class ServiceUnavailableException extends RpcServiceException {
  constructor(message: string) {
    super('SERVICE_UNAVAILABLE', message);
  }
}
