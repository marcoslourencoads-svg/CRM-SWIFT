import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { OrganizationBootstrapService } from './organization-bootstrap.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

class CompleteOnboardingDto {
  @IsString()
  @IsIn(['delivery', 'foodservice', 'varejo', 'servicos', 'outro'])
  @IsOptional()
  industry?: string;

  @IsString()
  @IsIn(['solo', 'small', 'medium', 'large'])
  @IsOptional()
  teamSize?: string;

  @IsString()
  @IsIn(['vender_mais', 'organizar', 'gerenciar_time', 'automatizar'])
  @IsOptional()
  mainGoal?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  leadSources?: string[];
}

@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly bootstrap: OrganizationBootstrapService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('reseed')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  async reseed(@CurrentOrg() orgId: string) {
    const result = await this.bootstrap.bootstrap(orgId);
    return { ok: true, ...result };
  }

  /**
   * Marca o onboarding como completo e grava as respostas do wizard.
   * Idempotente: pode ser chamado de novo, sobrescreve as respostas.
   */
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER', 'ADMIN')
  async complete(
    @CurrentOrg() orgId: string,
    @Body() dto: CompleteOnboardingDto,
  ) {
    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        industry: dto.industry,
        teamSize: dto.teamSize,
        mainGoal: dto.mainGoal,
        leadSourcesInitial: dto.leadSources ?? [],
        onboardedAt: new Date(),
      },
    });
    return updated;
  }
}
