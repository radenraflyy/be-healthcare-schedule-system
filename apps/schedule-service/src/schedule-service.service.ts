import { Injectable } from '@nestjs/common';

@Injectable()
export class ScheduleServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
