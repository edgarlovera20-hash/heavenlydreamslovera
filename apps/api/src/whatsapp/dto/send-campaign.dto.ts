import { IsArray, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendCampaignDto {
  @ApiProperty({ description: 'Session ID to use for sending' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ description: 'List of phone numbers', type: [String] })
  @IsArray()
  @IsString({ each: true })
  targets: string[];

  @ApiProperty({ description: 'Campaign message content' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
