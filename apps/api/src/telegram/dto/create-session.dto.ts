import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TelegramPurpose {
  CAPTACION = 'CAPTACION',
  SOPORTE = 'SOPORTE',
  COMUNIDAD = 'COMUNIDAD',
}

export class CreateTelegramSessionDto {
  @ApiProperty({ description: 'Display name for this bot session' })
  @IsString()
  botName: string;

  @ApiProperty({ description: 'Telegram bot token from BotFather' })
  @IsString()
  botToken: string;

  @ApiProperty({ enum: TelegramPurpose, description: 'Purpose of this bot' })
  @IsEnum(TelegramPurpose)
  purpose: TelegramPurpose;
}
