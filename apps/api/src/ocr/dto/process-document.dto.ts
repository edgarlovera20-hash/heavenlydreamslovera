import { IsEnum, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum DocumentType {
  INE = 'INE',
  COMPROBANTE = 'COMPROBANTE',
  CURP = 'CURP',
}

export class ProcessDocumentDto {
  @ApiProperty({ description: 'URL of the document to process' })
  @IsUrl()
  documentUrl: string;

  @ApiProperty({ enum: DocumentType, description: 'Type of document' })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({ description: 'Sale ID associated with this document' })
  @IsString()
  saleId: string;
}
