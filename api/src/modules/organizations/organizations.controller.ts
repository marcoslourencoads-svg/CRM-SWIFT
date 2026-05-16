import { Body, Controller, Get, Patch } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrganizationsService } from './organizations.service';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

class UpdateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;
}

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get('me')
  findMe(@CurrentOrg() orgId: string) {
    return this.service.findMe(orgId);
  }

  @Patch('me')
  @Roles('OWNER', 'ADMIN')
  updateMe(
    @CurrentOrg() orgId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.service.updateMe(orgId, dto);
  }
}
