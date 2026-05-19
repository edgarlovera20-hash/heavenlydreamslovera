import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FraudService } from './fraud.service';
import { CreateFlagDto } from './dto/create-flag.dto';

@ApiTags('fraud')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fraud')
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Post('analyze/:saleId')
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  analyzeSale(
    @Param('saleId') saleId: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.fraudService.analyzeSale(saleId, user.companyId);
  }

  @Get('flags/:saleId')
  @Roles(
    Role.GERENTE,
    Role.ADMINISTRACION,
    Role.SUPERVISOR,
    Role.SUPER_ADMIN,
  )
  getFlags(
    @Param('saleId') saleId: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.fraudService.getFlags(saleId, user.companyId);
  }

  @Post('flags')
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  createFlag(
    @Body() dto: CreateFlagDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.fraudService.createFlag(dto, user.companyId);
  }

  @Patch('flags/:flagId/resolve')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  resolveFlag(
    @Param('flagId') flagId: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.fraudService.resolveFlag(flagId, user.companyId);
  }
}
