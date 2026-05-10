import { Module } from '@nestjs/common';
import { LostReasonsController } from './lost-reasons.controller';
import { LostReasonsService } from './lost-reasons.service';

@Module({
  controllers: [LostReasonsController],
  providers: [LostReasonsService],
  exports: [LostReasonsService],
})
export class LostReasonsModule {}
