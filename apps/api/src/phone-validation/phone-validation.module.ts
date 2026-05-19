import { Module } from '@nestjs/common';
import { PhoneValidationService } from './phone-validation.service';
import { PhoneValidationController } from './phone-validation.controller';

@Module({
  controllers: [PhoneValidationController],
  providers: [PhoneValidationService],
  exports: [PhoneValidationService],
})
export class PhoneValidationModule {}
