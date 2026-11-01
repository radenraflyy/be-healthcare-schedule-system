import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AuthService } from './auth-service.service.js';

@Controller()
export class AuthServiceController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern({ cmd: 'auth.hello' })
  getHello(): string {
    return this.authService.getHello();
  }
}
