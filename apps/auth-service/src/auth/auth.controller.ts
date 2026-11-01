import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';

import { ServiceErrorException } from '../../../common/exceptions/index.js';
import { AuthService } from './auth.service.js';
import type { LoginInput, RegisterInput, SetUserRoleInput, TokenInput } from './dto/auth.inputs.js';

@Controller()
export class AuthServiceController {
  private readonly logger = new Logger(AuthServiceController.name);

  constructor(private readonly authService: AuthService) {}

  @MessagePattern({ cmd: 'auth.hello' })
  getHello(): string {
    return this.authService.getHello();
  }

  @MessagePattern({ cmd: 'auth.health' })
  getHealth(): string {
    return this.authService.getHello();
  }

  @MessagePattern({ cmd: 'auth.register' })
  register(@Payload() input: RegisterInput) {
    return this.run(
      () => this.authService.register(input),
      'Pendaftaran belum dapat diproses. Coba lagi sebentar.',
      'register',
    );
  }

  @MessagePattern({ cmd: 'auth.login' })
  login(@Payload() input: LoginInput) {
    return this.run(
      () => this.authService.login(input),
      'Login belum dapat diproses. Coba lagi sebentar.',
      'login',
    );
  }

  @MessagePattern({ cmd: 'auth.validateToken' })
  validateToken(@Payload() input: TokenInput) {
    return this.run(
      () => this.authService.validateToken(input),
      'Token belum dapat divalidasi. Coba lagi sebentar.',
      'validateToken',
    );
  }

  @MessagePattern({ cmd: 'auth.setUserRole' })
  setUserRole(@Payload() input: SetUserRoleInput) {
    return this.run(
      () => this.authService.setUserRole(input),
      'Role pengguna belum dapat diubah. Coba lagi sebentar.',
      'setUserRole',
    );
  }

  private async run<T>(
    operation: () => Promise<T>,
    fallbackMessage: string,
    operationName: string,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof RpcException) {
        throw error;
      }

      const errorType = error instanceof Error ? error.name : typeof error;
      const errorCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
          ? `, code ${error.code}`
          : '';
      const diagnosticMessage =
        error instanceof Error
          ? error.message
              .replace(/postgres(?:ql)?:\/\/[^\s/:@]+:[^\s@]+@/gi, 'postgresql://[redacted]@')
              .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
              .slice(0, 240)
          : '';
      this.logger.error(
        `Unexpected error while processing auth.${operationName} (${errorType}${errorCode})${diagnosticMessage ? `: ${diagnosticMessage}` : ''}`,
      );
      throw new ServiceErrorException(fallbackMessage);
    }
  }
}
