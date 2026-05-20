import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { AutomationService } from './automation.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { TriggerFlowDto } from './dto/trigger-flow.dto';

@ApiTags('automation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get()
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all automation flows for the company' })
  findAll(@CurrentUser() user: { companyId: string }) {
    return this.automationService.findAll(user.companyId);
  }

  @Get('stats')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get automation execution statistics' })
  getStats(@CurrentUser() user: { companyId: string }) {
    return this.automationService.getStats(user.companyId);
  }

  @Get(':id/logs')
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get execution logs for a specific automation flow' })
  getLogs(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.automationService.getLogs(id, user.companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new automation flow' })
  create(
    @Body() dto: CreateFlowDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.automationService.create(dto, user.companyId);
  }

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Trigger an automation flow for a specific target' })
  triggerFlow(
    @Body() dto: TriggerFlowDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.automationService.triggerFlow(dto, user.companyId);
  }

  @Patch(':id')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an automation flow configuration' })
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateFlowDto>,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.automationService.update(id, dto, user.companyId);
  }

  @Patch(':id/toggle')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Toggle the active state of an automation flow' })
  toggle(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.automationService.toggle(id, user.companyId);
  }
}
