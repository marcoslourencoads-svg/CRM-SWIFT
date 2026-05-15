import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PipelinePermissionsService } from './pipeline-permissions.service';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

class UpsertPermissionDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsBoolean()
  @IsOptional()
  canEdit?: boolean;

  @IsBoolean()
  @IsOptional()
  canSeeAllLeads?: boolean;
}

@Controller('pipelines/:pipelineId/permissions')
export class PipelinePermissionsController {
  constructor(private readonly service: PipelinePermissionsService) {}

  @Get()
  @Roles('ADMIN')
  list(@CurrentOrg() _orgId: string, @Param('pipelineId') pipelineId: string) {
    return this.service.list(pipelineId);
  }

  @Put()
  @Roles('ADMIN')
  upsert(
    @CurrentOrg() _orgId: string,
    @Param('pipelineId') pipelineId: string,
    @Body() dto: UpsertPermissionDto,
  ) {
    return this.service.upsert(
      pipelineId,
      dto.userId,
      dto.canEdit ?? true,
      dto.canSeeAllLeads ?? false,
    );
  }

  @Delete(':userId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentOrg() _orgId: string,
    @Param('pipelineId') pipelineId: string,
    @Param('userId') userId: string,
  ) {
    return this.service.remove(pipelineId, userId);
  }
}
