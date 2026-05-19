import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'message-sending' }),
    BullModule.registerQueue({ name: 'campaigns' }),
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
