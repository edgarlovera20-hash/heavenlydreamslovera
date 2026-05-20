import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@ApiTags('announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  @Get()
  findAll(@CurrentUser() user: { companyId: string }) {
    return this.service.findAll(user.companyId);
  }

  @Post()
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  create(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateAnnouncementDto>,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.service.update(id, dto, user.companyId);
  }

  @Delete(':id')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: { companyId: string }) {
    return this.service.remove(id, user.companyId);
  }
}
