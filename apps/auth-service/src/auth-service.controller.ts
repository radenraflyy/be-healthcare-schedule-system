import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth-service.service.js';

@Controller()
export class AuthServiceController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  getHello(): string {
    return this.authService.getHello();
  }
}
