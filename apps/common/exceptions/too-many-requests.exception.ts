import { RpcServiceException } from './rpc-service.exception.js';

export class TooManyRequestsException extends RpcServiceException {
  constructor(message: string) {
    super('THROTTLED', message);
  }
}
