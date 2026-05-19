import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum KbCategory {
  PROMOCION = 'PROMOCION',
  BENEFICIO = 'BENEFICIO',
  FAQ = 'FAQ',
  MANUAL = 'MANUAL',
  ONBOARDING = 'ONBOARDING',
  COBRANZA = 'COBRANZA',
}

export class CreateKnowledgeEntryDto {
  @ApiProperty({ description: 'Title of the knowledge base entry' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Content of the knowledge base entry' })
  @IsString()
  content: string;

  @ApiProperty({ enum: KbCategory, description: 'Category classification' })
  @IsEnum(KbCategory)
  category: KbCategory;

  @ApiPropertyOptional({ type: [String], description: 'Tags for the entry' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
