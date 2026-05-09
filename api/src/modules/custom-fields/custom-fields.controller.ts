import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service';
import { CreateFieldDefinitionDto } from './dto/create-field-definition.dto';
import { UpdateFieldDefinitionDto } from './dto/update-field-definition.dto';
import { SetFieldValuesDto } from './dto/set-field-values.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg, CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class CustomFieldsController {
  constructor(private readonly service: CustomFieldsService) {}

  @Get('pipelines/:pipelineId/custom-fields')
  listDefinitions(
    @CurrentOrg() _orgId: string,
    @Param('pipelineId') pipelineId: string,
  ) {
    return this.service.listDefinitions(pipelineId);
  }

  @Post('pipelines/:pipelineId/custom-fields')
  @Roles('ADMIN')
  createDefinition(
    @CurrentOrg() _orgId: string,
    @Param('pipelineId') pipelineId: string,
    @Body() dto: CreateFieldDefinitionDto,
  ) {
    return this.service.createDefinition(pipelineId, dto);
  }

  @Patch('custom-fields/:id')
  @Roles('ADMIN')
  updateDefinition(
    @CurrentOrg() _orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFieldDefinitionDto,
  ) {
    return this.service.updateDefinition(id, dto);
  }

  @Delete('custom-fields/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDefinition(@CurrentOrg() _orgId: string, @Param('id') id: string) {
    return this.service.deleteDefinition(id);
  }

  @Put('leads/:leadId/custom-fields')
  setValues(
    @CurrentOrg() _orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('leadId') leadId: string,
    @Body() dto: SetFieldValuesDto,
  ) {
    return this.service.setValues(leadId, dto.values, user.sub);
  }

  @Get('leads/:leadId/custom-fields')
  getValues(
    @CurrentOrg() _orgId: string,
    @Param('leadId') leadId: string,
  ) {
    return this.service.getValues(leadId);
  }
}
