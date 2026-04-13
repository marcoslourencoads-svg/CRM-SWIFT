import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg, CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('api-keys')
@Roles('ADMIN')
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Post()
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.service.create(orgId, user.sub, dto);
  }

  @Get()
  findAll(@CurrentOrg() orgId: string) {
    return this.service.findAll(orgId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.revoke(orgId, id);
  }
}
