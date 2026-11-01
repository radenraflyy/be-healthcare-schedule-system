import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { AuthenticatedCommand } from '../../../common/types/authenticated-command.js';
import type { CustomerInput } from './dto/customer.input.js';
import type { PageInput } from '../common/types/pagination.js';
import { CustomersService } from './customers.service.js';

@Controller()
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @MessagePattern({ cmd: 'customer.create' })
  create(@Payload() input: AuthenticatedCommand<CustomerInput>) {
    return this.customers.createCustomer(input);
  }

  @MessagePattern({ cmd: 'customer.update' })
  update(
    @Payload() input: AuthenticatedCommand<CustomerInput & { id?: string }>,
  ) {
    return this.customers.updateCustomer(input);
  }

  @MessagePattern({ cmd: 'customer.list' })
  list(@Payload() input: AuthenticatedCommand<PageInput>) {
    return this.customers.customers(input);
  }

  @MessagePattern({ cmd: 'customer.get' })
  get(@Payload() input: AuthenticatedCommand<{ id?: string }>) {
    return this.customers.customer(input);
  }

  @MessagePattern({ cmd: 'customer.delete' })
  delete(@Payload() input: AuthenticatedCommand<{ id?: string }>) {
    return this.customers.deleteCustomer(input);
  }
}
