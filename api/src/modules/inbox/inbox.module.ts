import { Module } from '@nestjs/common';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { InboxPublisher } from './inbox.publisher';
import { InboxProviderRegistry } from './providers/provider.registry';
import { ManualProvider } from './providers/manual.provider';
import { EvolutionProvider } from './providers/evolution.provider';
import { ZapiProvider } from './providers/zapi.provider';
import { MetaCloudProvider } from './providers/meta-cloud.provider';

@Module({
  controllers: [InboxController],
  providers: [
    InboxService,
    InboxPublisher,
    InboxProviderRegistry,
    ManualProvider,
    EvolutionProvider,
    ZapiProvider,
    MetaCloudProvider,
  ],
  exports: [InboxService],
})
export class InboxModule {}
