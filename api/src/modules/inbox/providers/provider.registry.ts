import { Injectable } from '@nestjs/common';
import { ChannelProvider } from '@prisma/client';
import { ManualProvider } from './manual.provider';
import { EvolutionProvider } from './evolution.provider';
import { ZapiProvider } from './zapi.provider';
import { MetaCloudProvider } from './meta-cloud.provider';
import type { IInboxProvider } from './provider.interface';

@Injectable()
export class InboxProviderRegistry {
  private readonly providers: Record<ChannelProvider, IInboxProvider>;

  constructor(
    manual: ManualProvider,
    evolution: EvolutionProvider,
    zapi: ZapiProvider,
    metaCloud: MetaCloudProvider,
  ) {
    this.providers = {
      MANUAL: manual,
      EVOLUTION: evolution,
      ZAPI: zapi,
      META_CLOUD: metaCloud,
    };
  }

  get(provider: ChannelProvider): IInboxProvider {
    return this.providers[provider] ?? this.providers.MANUAL;
  }
}
