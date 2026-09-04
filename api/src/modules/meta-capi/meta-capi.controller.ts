import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MetaCapiService, MetaEventName } from './meta-capi.service';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SendMetaEventDto } from './dto/send-meta-event.dto';

@Controller()
export class MetaCapiController {
  constructor(private readonly service: MetaCapiService) {}

  /** Estado da integração + placar por evento/status. */
  @Get('meta-capi/stats')
  @Roles('ADMIN')
  stats(@CurrentOrg() orgId: string) {
    return this.service.stats(orgId);
  }

  /** Últimos envios, opcionalmente filtrados por status. */
  @Get('meta-capi/events')
  @Roles('ADMIN')
  listRecent(
    @CurrentOrg() orgId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listRecent(orgId, status, limit ? Number(limit) : 50);
  }

  /** Histórico de envio de um lead específico. */
  @Get('meta-capi/leads/:leadId/events')
  @Roles('ADMIN')
  listForLead(@CurrentOrg() orgId: string, @Param('leadId') leadId: string) {
    return this.service.listForLead(orgId, leadId);
  }

  /**
   * Dispara um evento manualmente.
   * Use force:true apenas para reenviar algo que falhou — sem ele, a
   * deduplicação bloqueia o segundo envio do mesmo evento para o mesmo lead.
   */
  @Post('meta-capi/leads/:leadId/send')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  send(
    @CurrentOrg() orgId: string,
    @Param('leadId') leadId: string,
    @Body() dto: SendMetaEventDto,
  ) {
    return this.service.sendForLead(
      orgId,
      leadId,
      dto.eventName as MetaEventName,
      { force: dto.force ?? false },
    );
  }
}
