import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'message-sending' }),
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
