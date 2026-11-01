import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import type { DoctorInput } from './dto/doctor.input.js';
import type { PageInput } from '../common/types/pagination.js';
import { DoctorsService } from './doctors.service.js';

@Controller()
export class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}

  @MessagePattern({ cmd: 'doctor.create' })
  create(@Payload() input: AuthenticatedCommand<DoctorInput>) {
    return this.doctors.createDoctor(input);
  }

  @MessagePattern({ cmd: 'doctor.update' })
  update(
    @Payload() input: AuthenticatedCommand<DoctorInput & { id?: string }>,
  ) {
    return this.doctors.updateDoctor(input);
  }

  @MessagePattern({ cmd: 'doctor.list' })
  list(@Payload() input: AuthenticatedCommand<PageInput>) {
    return this.doctors.doctors(input);
  }

  @MessagePattern({ cmd: 'doctor.get' })
  get(@Payload() input: AuthenticatedCommand<{ id?: string }>) {
    return this.doctors.doctor(input);
  }

  @MessagePattern({ cmd: 'doctor.delete' })
  delete(@Payload() input: AuthenticatedCommand<{ id?: string }>) {
    return this.doctors.deleteDoctor(input);
  }
}
