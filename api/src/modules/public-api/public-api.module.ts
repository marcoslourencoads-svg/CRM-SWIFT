import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { LeadTrackingModule } from '../lead-tracking/lead-tracking.module';

@Module({
  imports: [ApiKeysModule, LeadTrackingModule],
  controllers: [PublicApiController],
})
export class PublicApiModule {}
