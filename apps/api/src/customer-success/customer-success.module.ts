import { Module } from '@nestjs/common';
import { CustomerSuccessService } from './customer-success.service';
import { CustomerSuccessController } from './customer-success.controller';

@Module({
  controllers: [CustomerSuccessController],
  providers: [CustomerSuccessService],
  exports: [CustomerSuccessService],
})
export class CustomerSuccessModule {}
