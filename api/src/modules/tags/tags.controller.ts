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
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller()
export class TagsController {
  constructor(private readonly service: TagsService) {}

  // ─── Tag CRUD (ADMIN only) ──────────────────────────────

  @Get('tags')
  @Roles('ADMIN')
  findAll(@CurrentOrg() orgId: string) {
    return this.service.findAll(orgId);
  }

  @Post('tags')
  @Roles('ADMIN')
  create(@CurrentOrg() orgId: string, @Body() dto: CreateTagDto) {
    return this.service.create(orgId, dto);
  }

  @Patch('tags/:id')
  @Roles('ADMIN')
  update(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.service.update(orgId, id, dto);
  }

  @Delete('tags/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.remove(orgId, id);
  }

  // ─── Lead ↔ Tag Association (any role) ───────────────────

  @Post('leads/:leadId/tags')
  addTagToLead(
    @CurrentOrg() orgId: string,
    @Param('leadId') leadId: string,
    @Body('tagId') tagId: string,
  ) {
    return this.service.addTagToLead(orgId, leadId, tagId);
  }

  @Delete('leads/:leadId/tags/:tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTagFromLead(
    @CurrentOrg() orgId: string,
    @Param('leadId') leadId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.service.removeTagFromLead(orgId, leadId, tagId);
  }
}
