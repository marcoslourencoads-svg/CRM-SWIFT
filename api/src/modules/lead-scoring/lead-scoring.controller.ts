import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LeadScoringService } from './lead-scoring.service';
import { CreateScoringRuleDto } from './dto/create-scoring-rule.dto';
import { UpdateScoringRuleDto } from './dto/update-scoring-rule.dto';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller()
export class LeadScoringController {
  constructor(private readonly service: LeadScoringService) {}

  // ─── Scoring Rules CRUD (ADMIN only) ───────────────────────

  @Post('scoring/rules')
  @Roles('ADMIN')
  createRule(@CurrentOrg() orgId: string, @Body() dto: CreateScoringRuleDto) {
    return this.service.createRule(orgId, dto);
  }

  @Get('scoring/rules')
  @Roles('ADMIN')
  findAllRules(@CurrentOrg() orgId: string) {
    return this.service.findAllRules(orgId);
  }

  @Get('scoring/rules/:id')
  @Roles('ADMIN')
  findOneRule(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.findOneRule(orgId, id);
  }

  @Patch('scoring/rules/:id')
  @Roles('ADMIN')
  updateRule(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateScoringRuleDto,
  ) {
    return this.service.updateRule(orgId, id, dto);
  }

  @Delete('scoring/rules/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRule(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.deleteRule(orgId, id);
  }

  // ─── Recalculate ────────────────────────────────────────────

  @Post('scoring/recalculate')
  @Roles('ADMIN')
  recalculateAll(@CurrentOrg() orgId: string) {
    return this.service.recalculateAll(orgId);
  }

  // ─── Lead Score ─────────────────────────────────────────────

  @Get('leads/:leadId/score')
  getLeadScore(@CurrentOrg() orgId: string, @Param('leadId') leadId: string) {
    return this.service.getLeadScore(orgId, leadId);
  }
}
