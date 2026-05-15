import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { SavedViewsService } from './saved-views.service';
import { CurrentOrg, CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

class UpsertSavedViewDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  pipelineId?: string;

  @IsObject()
  filters!: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isShared?: boolean;
}

@Controller('saved-views')
export class SavedViewsController {
  constructor(private readonly service: SavedViewsService) {}

  @Get()
  findAll(@CurrentOrg() orgId: string, @CurrentUser() user: JwtUser) {
    return this.service.findAll(orgId, user.sub);
  }

  @Post()
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertSavedViewDto,
  ) {
    return this.service.create(orgId, user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpsertSavedViewDto,
  ) {
    return this.service.update(orgId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.service.remove(orgId, user.sub, id);
  }
}
