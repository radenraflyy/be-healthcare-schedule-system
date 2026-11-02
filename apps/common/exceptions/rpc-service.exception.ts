import { RpcException } from '@nestjs/microservices';

export class RpcServiceException extends RpcException {
  constructor(
    readonly code: string,
    message: string,
    metadata: Record<string, number> = {},
  ) {
    super({ code, message, ...metadata });
  }
}
