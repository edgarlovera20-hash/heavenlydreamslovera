import {
  Body,
  Controller,
  Delete,
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
import { TelegramService } from './telegram.service';
import { CreateTelegramSessionDto } from './dto/create-session.dto';
import { SendTelegramMessageDto } from './dto/send-message.dto';

@ApiTags('telegram')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get('sessions')
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all Telegram bot sessions for the company' })
  getSessions(@CurrentUser() user: { companyId: string }) {
    return this.telegramService.getSessions(user.companyId);
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Register a new Telegram bot session' })
  createSession(
    @Body() dto: CreateTelegramSessionDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.telegramService.createSession(dto, user.companyId);
  }

  @Post('messages/send')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.GERENTE, Role.SUPERVISOR)
  @ApiOperation({ summary: 'Queue a Telegram message for sending' })
  sendMessage(
    @Body() dto: SendTelegramMessageDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.telegramService.sendMessage(dto, user.companyId);
  }

  @Get('messages/:sessionId')
  @Roles(Role.GERENTE, Role.SUPERVISOR, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get message history for a Telegram bot session' })
  getMessages(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.telegramService.getMessages(sessionId, user.companyId);
  }

  @Delete('sessions/:id')
  @Roles(Role.SUPER_ADMIN, Role.GERENTE)
  @ApiOperation({ summary: 'Deactivate a Telegram bot session' })
  deactivateSession(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.telegramService.deactivateSession(id, user.companyId);
  }
}
