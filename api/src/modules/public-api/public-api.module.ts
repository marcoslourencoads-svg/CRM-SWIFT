import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { LeadTrackingModule } from '../lead-tracking/lead-tracking.module';
import { TagsModule } from '../tags/tags.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';

@Module({
  imports: [ApiKeysModule, LeadTrackingModule, TagsModule, CustomFieldsModule],
  controllers: [PublicApiController],
})
export class PublicApiModule {}
