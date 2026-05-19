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
import { EmailValidationService } from './email-validation.service';
import { ValidateEmailDto } from './dto/validate-email.dto';

@ApiTags('email-validation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('email-validation')
export class EmailValidationController {
  constructor(
    private readonly emailValidationService: EmailValidationService,
  ) {}

  @Post('validate')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    Role.PROMOTOR,
    Role.SUPERVISOR,
    Role.ADMINISTRACION,
    Role.GERENTE,
    Role.SUPER_ADMIN,
    Role.COBRANZA,
    Role.SOPORTE,
  )
  @ApiOperation({ summary: 'Validate an email address and store result' })
  validate(
    @Body() dto: ValidateEmailDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.emailValidationService.validate(dto, user.companyId);
  }

  @Get('result/:saleId')
  @Roles(
    Role.GERENTE,
    Role.ADMINISTRACION,
    Role.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Get full email validation result for a sale' })
  getValidation(
    @Param('saleId') saleId: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.emailValidationService.getValidation(saleId, user.companyId);
  }
}
