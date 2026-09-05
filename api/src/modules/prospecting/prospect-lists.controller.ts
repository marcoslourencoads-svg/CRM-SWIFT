import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProspectListsService } from './prospect-lists.service';
import { CurrentOrg, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpsertProspectListDto, UpsertApproachDto } from './dto/prospect-list.dto';
import { UpsertProspectNoteDto } from './dto/prospect.dto';
import { ProspectsService } from './prospects.service';

@Controller('prospect-lists')
export class ProspectListsController {
  constructor(private readonly service: ProspectListsService) {}

  @Get()
  findAll(@CurrentOrg() orgId: string, @Query('includeArchived') includeArchived?: string) {
    return this.service.findAll(orgId, includeArchived === 'true');
  }

  @Post()
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpsertProspectListDto,
  ) {
    return this.service.create(orgId, userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpsertProspectListDto,
  ) {
    return this.service.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.remove(orgId, id);
  }
}

@Controller('prospect-approaches')
export class ProspectApproachesController {
  constructor(private readonly service: ProspectListsService) {}

  @Get()
  findAll(@CurrentOrg() orgId: string) {
    return this.service.findApproaches(orgId);
  }

  @Post()
  create(@CurrentOrg() orgId: string, @Body() dto: UpsertApproachDto) {
    return this.service.createApproach(orgId, dto);
  }

  @Patch(':id')
  update(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpsertApproachDto,
  ) {
    return this.service.updateApproach(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.removeApproach(orgId, id);
  }
}

@Controller('prospect-notes')
export class ProspectNotesController {
  constructor(private readonly service: ProspectsService) {}

  @Patch(':id')
  update(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpsertProspectNoteDto,
  ) {
    return this.service.updateNote(orgId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.removeNote(orgId, id);
  }
}
