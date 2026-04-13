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
import { MembershipsService } from './memberships.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { CurrentOrg, CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller()
export class MembershipsController {
  constructor(private readonly service: MembershipsService) {}

  @Get('members')
  listMembers(@CurrentOrg() orgId: string) {
    return this.service.listMembers(orgId);
  }

  @Post('invitations')
  invite(
    @CurrentOrg() orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.service.inviteMember(orgId, user.sub, dto.email, dto.role);
  }

  @Get('invitations')
  listInvitations(@CurrentOrg() orgId: string) {
    return this.service.listInvitations(orgId);
  }

  @Public()
  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  acceptInvite(@Body() body: { token: string; name: string; password: string }) {
    return this.service.acceptInvite(body.token, body.name, body.password);
  }

  @Roles('ADMIN')
  @Patch('members/:id/role')
  updateRole(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.service.updateRole(orgId, id, dto.role);
  }

  @Roles('ADMIN')
  @Delete('members/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeMember(orgId, id);
  }
}
