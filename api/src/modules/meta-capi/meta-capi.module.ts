import { Global, Module } from '@nestjs/common';
import { MetaCapiService } from './meta-capi.service';
import { MetaCapiListener } from './meta-capi.listener';
import { MetaCapiController } from './meta-capi.controller';

@Global()
@Module({
  controllers: [MetaCapiController],
  providers: [MetaCapiService, MetaCapiListener],
  exports: [MetaCapiService],
})
export class MetaCapiModule {}
