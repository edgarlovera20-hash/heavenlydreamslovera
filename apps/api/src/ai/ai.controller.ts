import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
import { AiService } from './ai.service';
import { AskAiDto } from './dto/ask-ai.dto';
import { AnalyzeFraudDto } from './dto/analyze-fraud.dto';
import { OcrCleanupDto } from './dto/ocr-cleanup.dto';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @Roles(
    Role.SUPER_ADMIN,
    Role.GERENTE,
    Role.ADMINISTRACION,
    Role.SUPERVISOR,
    Role.PROMOTOR,
    Role.COBRANZA,
    Role.SOPORTE,
  )
  @ApiOperation({ summary: 'Ask a question to the AI assistant with optional RAG context' })
  askQuestion(
    @Body() dto: AskAiDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.aiService.askQuestion(dto, user.companyId);
  }

  @Post('fraud-analysis')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Run AI-powered fraud analysis on a sale' })
  analyzeFraud(@Body() dto: AnalyzeFraudDto) {
    return this.aiService.analyzeFraud(dto);
  }

  @Post('ocr-cleanup')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMINISTRACION, Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Clean up and structure raw OCR text using Phi-3' })
  cleanupOcrText(@Body() dto: OcrCleanupDto) {
    return this.aiService.cleanupOcrText(dto);
  }
}
