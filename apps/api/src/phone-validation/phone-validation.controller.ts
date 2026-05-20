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
import { PhoneValidationService } from './phone-validation.service';
import { ValidatePhoneDto } from './dto/validate-phone.dto';

@ApiTags('phone-validation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('phone-validation')
export class PhoneValidationController {
  constructor(
    private readonly phoneValidationService: PhoneValidationService,
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
  @ApiOperation({ summary: 'Validate a phone number and store result' })
  async validate(
    @Body() dto: ValidatePhoneDto,
    @CurrentUser() user: { companyId: string; role: Role },
  ) {
    const result = await this.phoneValidationService.validate(dto, user.companyId);
    return { valid: result.valid };
  }

  @Get('result/:saleId')
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get full phone validation result for a sale' })
  getValidation(
    @Param('saleId') saleId: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.phoneValidationService.getValidation(saleId, user.companyId);
  }
}
