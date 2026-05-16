import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { OrganizationBootstrapService } from './organization-bootstrap.service';
import { CurrentOrg } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly bootstrap: OrganizationBootstrapService) {}

  /**
   * Re-roda o bootstrap (idempotente) na org atual.
   * Útil pra orgs antigas que foram criadas antes do bootstrap automático.
   * Apenas OWNER pode disparar.
   */
  @Post('reseed')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER')
  async reseed(@CurrentOrg() orgId: string) {
    const result = await this.bootstrap.bootstrap(orgId);
    return { ok: true, ...result };
  }
}
