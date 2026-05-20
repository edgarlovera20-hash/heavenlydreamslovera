import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WhatsAppService } from './whatsapp.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { SendCampaignDto } from './dto/send-campaign.dto';

@ApiTags('whatsapp')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsAppService: WhatsAppService) {}

  @Get('sessions')
  @Roles(
    Role.GERENTE,
    Role.ADMINISTRACION,
    Role.SUPERVISOR,
    Role.SUPER_ADMIN,
  )
  getSessions(@CurrentUser() user: { companyId: string }) {
    return this.whatsAppService.getSessions(user.companyId);
  }

  @Post('sessions')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  createSession(
    @Body() dto: CreateSessionDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.whatsAppService.createSession(dto, user.companyId);
  }

  @Get('sessions/:id/qr')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  getQR(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.whatsAppService.getQR(id, user.companyId);
  }

  @Get('sessions/:id/messages')
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPERVISOR, Role.SUPER_ADMIN)
  getRecentMessages(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.whatsAppService.getRecentMessages(id, user.companyId);
  }

  @Post('sessions/:id/disconnect')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  disconnectSession(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.whatsAppService.disconnectSession(id, user.companyId);
  }

  @Post('messages/send')
  sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.whatsAppService.sendMessage(dto, user.companyId);
  }

  @Post('campaigns')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  sendCampaign(
    @Body() dto: SendCampaignDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.whatsAppService.sendCampaign(
      dto.targets,
      dto.message,
      dto.sessionId,
      user.companyId,
    );
  }
}
