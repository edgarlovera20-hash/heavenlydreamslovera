import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OcrService } from './ocr.service';
import { ProcessDocumentDto } from './dto/process-document.dto';

@ApiTags('ocr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('process')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Queue an OCR processing job for a document' })
  queueOcr(
    @Body() dto: ProcessDocumentDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.ocrService.queueOcr(dto, user.companyId);
  }

  @Get('result/:saleId')
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get OCR processing result for a sale' })
  getOcrResult(
    @Param('saleId') saleId: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.ocrService.getOcrResult(saleId, user.companyId);
  }
}
