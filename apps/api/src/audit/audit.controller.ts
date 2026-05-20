import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get recent audit logs for the company' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser() user: { companyId: string },
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findAll(
      user.companyId,
      limit ? parseInt(limit, 10) : 200,
    );
  }

  @Get('entity/:type/:id')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get audit logs for a specific entity by type and ID' })
  findByEntity(
    @Param('type') type: string,
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.auditService.findByEntity(type, id, user.companyId);
  }
}
