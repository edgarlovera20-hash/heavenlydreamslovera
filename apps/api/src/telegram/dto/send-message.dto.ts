import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendTelegramMessageDto {
  @ApiProperty({ description: 'Session ID of the Telegram bot to use' })
  @IsString()
  sessionId: string;

  @ApiProperty({ description: 'Telegram chat ID to send message to' })
  @IsString()
  chatId: string;

  @ApiProperty({ description: 'Message text to send' })
  @IsString()
  message: string;
}
