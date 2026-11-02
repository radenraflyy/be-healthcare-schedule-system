import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import type { PageInput } from '../common/types/pagination.js';
import type { SetAvailabilityInput } from '../schedules/dto/schedule.input.js';
import { DoctorsService } from './doctors.service.js';
import type { DoctorInput } from './dto/doctor.input.js';

@Controller()
export class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}

  @MessagePattern({ cmd: 'doctor.create' })
  create(@Payload() input: AuthenticatedCommand<DoctorInput>) {
    return this.doctors.createDoctor(input);
  }

  @MessagePattern({ cmd: 'doctor.update' })
  update(@Payload() input: AuthenticatedCommand<DoctorInput & { id?: string }>) {
    return this.doctors.updateDoctor(input);
  }

  @MessagePattern({ cmd: 'doctor.list' })
  list(@Payload() input: AuthenticatedCommand<PageInput>) {
    return this.doctors.doctors(input);
  }

  @MessagePattern({ cmd: 'doctor.unlinked' })
  unlinked(@Payload() input: AuthenticatedCommand<Record<string, never>>) {
    return this.doctors.unlinkedDoctors(input);
  }

  @MessagePattern({ cmd: 'doctor.get' })
  get(@Payload() input: AuthenticatedCommand<{ id?: string }>) {
    return this.doctors.doctor(input);
  }

  @MessagePattern({ cmd: 'doctor.delete' })
  delete(@Payload() input: AuthenticatedCommand<{ id?: string }>) {
    return this.doctors.deleteDoctor(input);
  }

  @MessagePattern({ cmd: 'availability.set' })
  setAvailability(@Payload() input: AuthenticatedCommand<SetAvailabilityInput>) {
    return this.doctors.setAvailability(input);
  }

  @MessagePattern({ cmd: 'availability.list' })
  availability(
    @Payload()
    input: AuthenticatedCommand<{ doctorId?: string; date?: string | Date }>,
  ) {
    return this.doctors.availability(input);
  }

  @MessagePattern({ cmd: 'availability.windows' })
  availabilityWindows(@Payload() input: AuthenticatedCommand<{ doctorId?: string }>) {
    return this.doctors.availabilityWindows(input);
  }

  @MessagePattern({ cmd: 'availability.delete' })
  deleteAvailability(@Payload() input: AuthenticatedCommand<{ id?: string }>) {
    return this.doctors.deleteAvailability(input);
  }
}
