import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import { type Observable, finalize } from 'rxjs';

@Injectable()
export class RabbitMqRpcAckInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const rmqContext = context.switchToRpc().getContext<RmqContext>();

    return next.handle().pipe(
      finalize(() => {
        rmqContext.getChannelRef().ack(rmqContext.getMessage());
      }),
    );
  }
}
