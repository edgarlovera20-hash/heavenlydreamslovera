import { Module } from '@nestjs/common';
import { EmailValidationService } from './email-validation.service';
import { EmailValidationController } from './email-validation.controller';

@Module({
  controllers: [EmailValidationController],
  providers: [EmailValidationService],
  exports: [EmailValidationService],
})
export class EmailValidationModule {}
