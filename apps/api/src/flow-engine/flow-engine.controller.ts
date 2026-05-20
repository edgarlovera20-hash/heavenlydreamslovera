import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { FlowEngineService } from './flow-engine.service';
import { StartFlowDto } from './dto/start-flow.dto';
import { ProcessMessageDto } from './dto/process-message.dto';
import { TransferAgentDto } from './dto/transfer-agent.dto';

@ApiTags('flow-engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('flow-engine')
export class FlowEngineController {
  constructor(private readonly flowEngineService: FlowEngineService) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    Role.SUPER_ADMIN,
    Role.GERENTE,
    Role.ADMINISTRACION,
    Role.SUPERVISOR,
    Role.PROMOTOR,
    Role.COBRANZA,
    Role.SOPORTE,
  )
  @ApiOperation({ summary: 'Start a new conversation flow for a channel' })
  startConversation(
    @Body() dto: StartFlowDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.flowEngineService.startConversation(dto, user.companyId);
  }

  @Post('message')
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
  @ApiOperation({ summary: 'Process an incoming message and advance the conversation state machine' })
  processMessage(
    @Body() dto: ProcessMessageDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.flowEngineService.processMessage(dto, user.companyId);
  }

  @Get('conversations')
  @Roles(Role.SUPERVISOR, Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all active conversations, optionally filtered by channel' })
  @ApiQuery({ name: 'channel', required: false })
  getActiveConversations(
    @CurrentUser() user: { companyId: string },
    @Query('channel') channel?: string,
  ) {
    return this.flowEngineService.getActiveConversations(user.companyId, channel);
  }

  @Get('conversations/:id')
  @Roles(
    Role.SUPER_ADMIN,
    Role.GERENTE,
    Role.ADMINISTRACION,
    Role.SUPERVISOR,
    Role.PROMOTOR,
    Role.COBRANZA,
    Role.SOPORTE,
  )
  @ApiOperation({ summary: 'Get conversation details including message history' })
  getConversation(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.flowEngineService.getConversation(id, user.companyId);
  }

  @Post('conversations/:id/transfer')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SUPERVISOR, Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Transfer a conversation to a specific agent' })
  transferToAgent(
    @Param('id') id: string,
    @Body() dto: TransferAgentDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.flowEngineService.transferToAgent(
      { ...dto, conversationId: id },
      user.companyId,
    );
  }

  @Post('conversations/:id/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(
    Role.SOPORTE,
    Role.SUPERVISOR,
    Role.ADMINISTRACION,
    Role.GERENTE,
    Role.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Mark a conversation as completed' })
  completeConversation(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.flowEngineService.completeConversation(id, user.companyId);
  }
}
