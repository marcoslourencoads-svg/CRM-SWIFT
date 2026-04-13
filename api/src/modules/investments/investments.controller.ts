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
import { InvestmentsService } from './investments.service';
import {
  CreateInvestmentDto,
  UpdateInvestmentDto,
} from './dto/create-investment.dto';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('investments')
export class InvestmentsController {
  constructor(private readonly service: InvestmentsService) {}

  @Get()
  @Roles('ADMIN')
  findAll(@CurrentOrg() orgId: string, @Query('month') month?: string) {
    return this.service.findAll(orgId, month);
  }

  @Get(':id')
  @Roles('ADMIN')
  findOne(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.service.findOne(orgId, id);
  }

  @Post()
  @Roles('ADMIN')
  create(@CurrentOrg() orgId: string, @Body() dto: CreateInvestmentDto) {
    return this.service.create(orgId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInvestmentDto,
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
