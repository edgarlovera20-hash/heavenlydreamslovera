import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'automation' }),
  ],
  controllers: [AutomationController],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
