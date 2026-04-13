import { Module } from '@nestjs/common';
import { LeadTrackingService } from './lead-tracking.service';

@Module({
  providers: [LeadTrackingService],
  exports: [LeadTrackingService],
})
export class LeadTrackingModule {}
