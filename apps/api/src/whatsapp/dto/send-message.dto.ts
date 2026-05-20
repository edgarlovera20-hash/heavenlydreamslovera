import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'WhatsApp session ID' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ description: 'Destination phone number (e.g. 521XXXXXXXXXX)' })
  @IsString()
  @IsNotEmpty()
  to: string;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ enum: ['TEXT', 'IMAGE'], default: 'TEXT' })
  @IsOptional()
  @IsString()
  @IsIn(['TEXT', 'IMAGE'])
  type?: string = 'TEXT';
}
