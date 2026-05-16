import { Module } from '@nestjs/common';
import { OrganizationBootstrapService } from './organization-bootstrap.service';
import { OnboardingController } from './onboarding.controller';

@Module({
  controllers: [OnboardingController],
  providers: [OrganizationBootstrapService],
  exports: [OrganizationBootstrapService],
})
export class OnboardingModule {}
