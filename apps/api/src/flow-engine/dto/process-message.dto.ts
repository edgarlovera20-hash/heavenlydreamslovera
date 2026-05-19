import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessMessageDto {
  @ApiProperty({ description: 'Conversation ID to process message for' })
  @IsString()
  conversationId: string;

  @ApiProperty({ description: 'Incoming message text' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'URL of media attachment if present' })
  @IsOptional()
  @IsString()
  mediaUrl?: string;
}
