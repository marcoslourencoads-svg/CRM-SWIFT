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
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller()
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Post('webhooks')
  @Roles('ADMIN')
  create(@CurrentOrg() orgId: string, @Body() dto: CreateWebhookDto) {
    return this.service.create(orgId, dto);
  }

  @Get('webhooks')
  @Roles('ADMIN')
  findAll(@CurrentOrg() orgId: string) {
    return this.service.findAll(orgId);
  }

  @Get('webhooks/:id')
  @Roles('ADMIN')
  findOne(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.findOne(orgId, id);
  }

  @Patch('webhooks/:id')
  @Roles('ADMIN')
  update(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.service.update(orgId, id, dto);
  }

  @Delete('webhooks/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.remove(orgId, id);
  }

  @Get('webhooks/:id/logs')
  @Roles('ADMIN')
  getLogs(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getLogsForWebhook(id, limit ? parseInt(limit, 10) : undefined);
  }

  @Post('webhooks/:id/test')
  @Roles('ADMIN')
  test(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.testWebhook(orgId, id);
  }
}
